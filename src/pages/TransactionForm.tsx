import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCollectionData } from "react-firebase-hooks/firestore";
import { getDoc, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { getUserCollections, type TransactionType, type TransactionSource } from "../db";
import { db as firestoreDb } from "../lib/firebase";
import { useAuthStore } from "../store/useAuthStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const formSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(50),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    type: z.enum(["Debit", "Credit", "Transfer"]),
    source: z.string().min(1, "Please select a source account"),
    toSource: z.string().optional(),
    category: z.enum(["Need", "Want", "Other"]).optional(),
    timestamp: z.date(),
}).superRefine((data, ctx) => {
    if (data.type === 'Transfer') {
        if (!data.toSource) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select a destination account",
                path: ["toSource"]
            });
        } else if (data.toSource === data.source) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Destination cannot be same as source",
                path: ["toSource"]
            });
        }
    }
});

export function TransactionForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const collections = getUserCollections(user?.uid);
    const isEditing = !!id;
    const [loadError, setLoadError] = useState("");

    const location = useLocation();
    const voiceData = location.state?.voiceData as Record<string, any> | undefined;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            title: voiceData?.title || "",
            amount: voiceData?.amount || (undefined as unknown as number),
            type: voiceData?.type || "Debit",
            source: voiceData?.source || "",
            toSource: voiceData?.toSource || "",
            category: voiceData?.category || "Need",
            timestamp: voiceData?.timestamp ? new Date(voiceData.timestamp) : new Date(),
        },
    });

    const [accounts] = useCollectionData(collections?.accounts);
    const [transactions] = useCollectionData(collections?.transactions);

    useEffect(() => {
        async function loadTransaction() {
            if (!isEditing || !user || !id) return;
            try {
                const txRef = doc(firestoreDb, 'users', user.uid, 'transactions', id);
                const snapshot = await getDoc(txRef);
                if (snapshot.exists()) {
                    const tx = snapshot.data();
                    form.reset({
                        title: tx.title,
                        amount: Math.abs(tx.amount), // Form shows positive, submission handles sign
                        type: tx.type,
                        source: tx.source,
                        toSource: tx.toSource || "",
                        category: tx.category || "Need",
                        timestamp: new Date(tx.timestamp),
                    });
                } else {
                    setLoadError("Transaction not found");
                }
            } catch (e) {
                setLoadError("Failed to load transaction");
            }
        }
        loadTransaction();
    }, [id, isEditing, form, user]);

    useEffect(() => {
        if (!isEditing && !voiceData?.source && accounts && accounts.length > 0 && !form.getValues("source")) {
            let defaultSource = accounts[0].name; // fallback to first account
            
            if (transactions && transactions.length > 0) {
                const accountCounts: Record<string, number> = {};
                transactions.forEach((t: any) => {
                    if (t.source) {
                        accountCounts[t.source] = (accountCounts[t.source] || 0) + 1;
                    }
                });
                let mostUsed = "";
                let maxCount = 0;
                for (const [acc, count] of Object.entries(accountCounts)) {
                    if (count > maxCount && accounts.find((a: any) => a.name === acc)) {
                        maxCount = count;
                        mostUsed = acc;
                    }
                }
                if (mostUsed) defaultSource = mostUsed;
            }
            
            form.setValue("source", defaultSource);
        }
    }, [transactions, accounts, isEditing, voiceData, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        // Determine the actual signed amount based on type
        let finalAmount = values.amount;
        if (values.type === 'Debit') {
            finalAmount = -Math.abs(values.amount);
        } else if (values.type === 'Credit' || values.type === 'Transfer') {
            finalAmount = Math.abs(values.amount); // Transfers store positive amounts
        }

        const transactionData: any = {
            title: values.title,
            amount: finalAmount,
            type: values.type as TransactionType,
            source: values.source as TransactionSource,
            timestamp: values.timestamp.toISOString(),
        };

        if (values.type === 'Transfer' && values.toSource) {
            transactionData.toSource = values.toSource as TransactionSource;
        } else if (values.type !== 'Transfer' && values.category) {
            transactionData.category = values.category as "Need" | "Want" | "Other";
        }

        try {
            if (!user || !collections) return;
            if (isEditing && id) {
                const txRef = doc(firestoreDb, 'users', user.uid, 'transactions', id);
                await updateDoc(txRef, transactionData);
            } else {
                await addDoc(collections.transactions, transactionData);
            }
            navigate("/");
        } catch (e) {
            console.error("Failed to save transaction", e);
            alert("Failed to save transaction.");
        }
    }

    async function handleDelete() {
        if (!isEditing || !user || !id) return;
        if (window.confirm("Are you sure you want to delete this entry?")) {
            await deleteDoc(doc(firestoreDb, 'users', user.uid, 'transactions', id));
            navigate("/");
        }
    }

    const watchedType = form.watch("type");

    if (loadError) return <div className="p-8 text-destructive">{loadError}</div>;
    // We optionally can wait for accounts to load to ensure dropdown isn't empty on fast loads
    if (accounts === undefined) return <div className="p-8 text-muted-foreground">Loading form...</div>;

    return (
        <div className="p-4 md:p-8 animate-in slide-in-from-bottom-4 duration-300">
            <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
            </Button>

            <Card className="max-w-xl mx-auto bg-card border-border text-foreground">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">{isEditing ? "Edit Entry" : "New Entry"}</CardTitle>
                        <CardDescription className="text-muted-foreground text-sm md:text-lg">Log a new financial transaction offline.</CardDescription>
                    </div>
                    {isEditing && (
                        <Button variant="destructive" size="icon" onClick={handleDelete}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Description / Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Weekly Groceries" className="bg-background border-border focus-visible:ring-primary" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-destructive" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" min="0" placeholder="0.00" className="bg-background border-border focus-visible:ring-primary" {...field} />
                                            </FormControl>
                                            <FormMessage className="text-destructive" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="timestamp"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="flex flex-col pt-2.5">
                                            <FormLabel>Date</FormLabel>
                                            <Popover>
                                                <FormControl>
                                                    <PopoverTrigger render={
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal bg-background border-border hover:bg-muted hover:text-foreground text-foreground",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        />
                                                    }>
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </PopoverTrigger>
                                                </FormControl>
                                                <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) =>
                                                            date > new Date() || date < new Date("1900-01-01")
                                                        }
                                                        initialFocus
                                                        className="text-popover-foreground"
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage className="text-destructive" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Cash Flow</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-background border-border text-foreground focus:ring-primary">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-popover border-border text-popover-foreground">
                                                    <SelectItem value="Debit">Debit (Expense)</SelectItem>
                                                    <SelectItem value="Credit">Credit (Income)</SelectItem>
                                                    <SelectItem value="Transfer">Transfer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-destructive" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="source"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>{watchedType === 'Transfer' ? 'From Account' : 'Source Account'}</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-background border-border text-foreground focus:ring-primary">
                                                        <SelectValue placeholder="Select source" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-popover border-border text-popover-foreground">
                                                    {accounts?.map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                                                    ))}
                                                    {accounts.length === 0 && (
                                                        <SelectItem value="none" disabled>No accounts found, please configure in Settings.</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-destructive" />
                                        </FormItem>
                                    )}
                                />

                                {watchedType === 'Transfer' && (
                                    <FormField
                                        control={form.control}
                                        name="toSource"
                                        render={({ field }: { field: any }) => (
                                            <FormItem>
                                                <FormLabel>To Account</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-background border-border text-foreground focus:ring-primary">
                                                            <SelectValue placeholder="Select destination" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-popover border-border text-popover-foreground">
                                                        {accounts?.map((acc: any) => (
                                                            <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                                                        ))}
                                                        {accounts.length === 0 && (
                                                            <SelectItem value="none" disabled>No accounts found, please configure in Settings.</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-destructive" />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {watchedType !== 'Transfer' && (
                                    <FormField
                                        control={form.control}
                                        name="category"
                                        render={({ field }: { field: any }) => (
                                            <FormItem>
                                                <FormLabel>Category</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-background border-border text-foreground focus:ring-primary">
                                                            <SelectValue placeholder="Select category" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-popover border-border text-popover-foreground">
                                                        <SelectItem value="Need">Need</SelectItem>
                                                        <SelectItem value="Want">Want</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-destructive" />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>

                            <Button type="submit" className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold border-0">
                                {isEditing ? "Save Changes" : "Save Entry"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

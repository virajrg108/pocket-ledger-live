import { useState } from "react";
import { useCollectionData } from "react-firebase-hooks/firestore";
import { addDoc, deleteDoc, doc, query, where, getDocs } from "firebase/firestore";
import { Plus, Trash2, Wallet } from "lucide-react";

import { getUserCollections } from "../db";
import { db as firestoreDb } from "../lib/firebase";
import { useAuthStore } from "../store/useAuthStore";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function Settings() {
    const { user, signOut } = useAuthStore();
    const collections = getUserCollections(user?.uid);
    const [newName, setNewName] = useState("");
    const [newBalance, setNewBalance] = useState("");

    const [accounts] = useCollectionData(collections?.accounts);
    const [transactions] = useCollectionData(collections?.transactions);

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !user || !collections) return;

        const balanceNum = parseFloat(newBalance) || 0;

        try {
            // Check if name already exists
            const q = query(collections.accounts, where('name', '==', newName.trim()));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                alert("An account with this name already exists.");
                return;
            }

            await addDoc(collections.accounts, {
                name: newName.trim(),
                initialBalance: balanceNum
            });

            setNewName("");
            setNewBalance("");
        } catch (error) {
            console.error("Failed to add account", error);
            alert("Failed to add account.");
        }
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (!user) return;
        // Simple safety check: don't delete if transactions are using it
        const inUse = transactions?.some(t => t.source === name || t.toSource === name);
        if (inUse) {
            alert(`Cannot delete '${name}' because there are transactions associated with it. Please reassign or delete those transactions first.`);
            return;
        }

        if (window.confirm(`Are you sure you want to delete the account '${name}'?`)) {
            await deleteDoc(doc(firestoreDb, 'users', user.uid, 'accounts', id));
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-4 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Settings</h2>
                <p className="text-muted-foreground text-sm md:text-lg">Manage your custom accounts and starting balances.</p>
            </div>

            <Card className="max-w-2xl bg-card border-border text-foreground">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-primary" />
                            Source Accounts
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Create diverse account buckets (e.g. 'Cash', 'Amex', 'Savings'). The dashboard will track these dynamically.
                        </CardDescription>
                    </div>
                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={signOut}>
                        Sign Out
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add New Form */}
                    <form onSubmit={handleAddAccount} className="flex flex-col sm:flex-row gap-3 items-end bg-background p-4 rounded-lg border border-border">
                        <div className="flex-1 w-full space-y-1">
                            <label className="text-sm text-muted-foreground font-medium">Account Name</label>
                            <Input
                                placeholder="e.g. Chase Sapphire"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="bg-background border-border focus-visible:ring-primary"
                                required
                            />
                        </div>
                        <div className="flex-1 w-full space-y-1">
                            <label className="text-sm text-muted-foreground font-medium">Initial Balance (₹)</label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                className="bg-background border-border focus-visible:ring-primary"
                            />
                        </div>
                        <Button type="submit" className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black font-bold border-0">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Account
                        </Button>
                    </form>

                    {/* Desktop Table mapping */}
                    <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-background">
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Name</TableHead>
                                    <TableHead className="text-muted-foreground text-right">Starting Balance</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!accounts || accounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                            No accounts configured yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    accounts.map((acc) => (
                                        <TableRow key={acc.id} className="border-border hover:bg-muted/50">
                                            <TableCell className="font-medium text-foreground">
                                                {acc.name}
                                            </TableCell>
                                            <TableCell className="text-right text-primary">
                                                {formatCurrency(acc.initialBalance)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                    onClick={() => acc.id && handleDeleteAccount(acc.id, acc.name)}
                                                    title="Delete Account"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

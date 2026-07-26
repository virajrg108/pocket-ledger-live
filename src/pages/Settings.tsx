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
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-50">Settings</h2>
                <p className="text-zinc-400 text-sm md:text-lg">Manage your custom accounts and starting balances.</p>
            </div>

            <Card className="max-w-2xl bg-zinc-900 border-zinc-800 text-zinc-50">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-400" />
                            Source Accounts
                        </CardTitle>
                        <CardDescription className="text-zinc-400">
                            Create diverse account buckets (e.g. 'Cash', 'Amex', 'Savings'). The dashboard will track these dynamically.
                        </CardDescription>
                    </div>
                    <Button variant="outline" className="border-rose-800 text-rose-400 hover:bg-rose-950" onClick={signOut}>
                        Sign Out
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add New Form */}
                    <form onSubmit={handleAddAccount} className="flex flex-col sm:flex-row gap-3 items-end bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                        <div className="flex-1 w-full space-y-1">
                            <label className="text-sm text-zinc-400 font-medium">Account Name</label>
                            <Input
                                placeholder="e.g. Chase Sapphire"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="bg-zinc-900 border-zinc-800 focus-visible:ring-emerald-500"
                                required
                            />
                        </div>
                        <div className="flex-1 w-full space-y-1">
                            <label className="text-sm text-zinc-400 font-medium">Initial Balance (₹)</label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                className="bg-zinc-900 border-zinc-800 focus-visible:ring-emerald-500"
                            />
                        </div>
                        <Button type="submit" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Account
                        </Button>
                    </form>

                    {/* Desktop Table mapping */}
                    <div className="rounded-md border border-zinc-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-zinc-950">
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400">Name</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Starting Balance</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!accounts || accounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-zinc-500 py-6">
                                            No accounts configured yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    accounts.map((acc) => (
                                        <TableRow key={acc.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                            <TableCell className="font-medium text-zinc-200">
                                                {acc.name}
                                            </TableCell>
                                            <TableCell className="text-right text-emerald-400">
                                                {formatCurrency(acc.initialBalance)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 h-8 w-8"
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

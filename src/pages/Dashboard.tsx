import { useCollectionData } from "react-firebase-hooks/firestore";
import { query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { getUserCollections } from "../db";
import { useAuthStore } from "../store/useAuthStore";
import { db as firestoreDb } from "../lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, IndianRupee } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

function getAccountTxDelta(t: { type?: string; source?: string; toSource?: string; amount: number }, accountName: string): number {
    const amt = Math.abs(t.amount);
    if (t.type === 'Transfer') {
        if (t.source === accountName) return -amt;
        if (t.toSource === accountName) return amt;
        return 0;
    }
    if (t.source === accountName) {
        if (t.type === 'Debit') return -amt;
        if (t.type === 'Credit') return amt;
        return t.amount;
    }
    return 0;
}

export function Dashboard() {
    const { user } = useAuthStore();
    const collections = getUserCollections(user?.uid);

    const [transactions, loadingTx, errorTx] = useCollectionData(
        collections ? query(collections.transactions, orderBy('timestamp', 'desc')) : null
    );
    const [accounts, loadingAcc, errorAcc] = useCollectionData(
        collections?.accounts
    );

    if (errorTx) return <div className="p-8 text-destructive">Error loading transactions: {errorTx.message}</div>;
    if (errorAcc) return <div className="p-8 text-destructive">Error loading accounts: {errorAcc.message}</div>;
    if (loadingTx || loadingAcc || !transactions || !accounts) return <div className="p-8 text-muted-foreground">Loading data...</div>;

    const totalBalance = accounts.reduce((accTotal, acc) => {
        const txSum = transactions.reduce((sum, t) => sum + getAccountTxDelta(t, acc.name), 0);
        return accTotal + acc.initialBalance + txSum;
    }, 0);

    const handleDelete = async (id?: string) => {
        if (!id || !user) return;
        if (window.confirm("Are you sure you want to delete this transaction from your history?")) {
            await deleteDoc(doc(firestoreDb, 'users', user.uid, 'transactions', id));
        }
    };

    return (
        <div className="flex flex-col flex-1 p-0 md:p-8 space-y-2 md:space-y-4 animate-in fade-in duration-500">
            <div className="hidden md:block">
                <h2 className="text-lg md:text-3xl font-bold tracking-tight text-foreground">Overview</h2>
                <p className="text-muted-foreground text-sm md:text-lg">Your financial snapshot</p>
            </div>

            <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950 shadow-md mb-2 md:mb-4 flex items-center justify-between px-4 py-3 md:flex-col md:justify-center md:py-6">
                <div className="text-sm md:text-base font-medium text-zinc-900/80 md:mb-2">Total Balance</div>
                <div className="text-xl md:text-3xl font-bold tracking-tight text-zinc-950">
                    {totalBalance < 0 ? '-' : ''}{formatCurrency(totalBalance)}
                </div>
            </div>

            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
                {accounts.map(acc => {
                    const txSum = transactions.reduce((sum, t) => sum + getAccountTxDelta(t, acc.name), 0);
                    const currentBalance = acc.initialBalance + txSum;

                    return (
                        <div key={acc.id} className="rounded-xl bg-card border border-border text-foreground shadow-sm flex flex-col justify-between p-2.5 md:p-6">
                            <div className="flex items-center justify-between mb-0.5 md:mb-2">
                                <div className="text-xs md:text-sm font-medium truncate pr-1">{acc.name}</div>
                                <IndianRupee className="w-3 h-3 md:w-4 md:h-4 shrink-0 text-muted-foreground" />
                            </div>
                            <div className={`text-base md:text-xl font-bold ${currentBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                {currentBalance < 0 ? '-' : ''}{formatCurrency(currentBalance)}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-xl bg-card border border-border text-foreground shadow-md overflow-hidden flex flex-col">
                <div className="p-3 pb-1 md:p-6 md:pb-2">
                    <div className="text-base md:text-lg font-semibold">Recent History</div>
                    <div className="text-[11px] md:text-sm text-muted-foreground">Your most recent local transactions.</div>
                </div>
                <div className="overflow-x-auto p-0 md:px-6 md:pb-6">
                    <Table>
                        <TableHeader className="border-border">
                            <TableRow className="border-border hover:bg-muted/50">
                                <TableHead className="h-8 md:h-12 w-[40px] md:w-[60px] text-[11px] md:text-sm text-muted-foreground px-2 md:px-4 py-1">Date</TableHead>
                                <TableHead className="h-8 md:h-12 text-[11px] md:text-sm text-muted-foreground px-2 md:px-4 py-1">Title</TableHead>
                                <TableHead className="h-8 md:h-12 text-muted-foreground hidden md:table-cell py-1">Source</TableHead>
                                <TableHead className="h-8 md:h-12 text-muted-foreground hidden sm:table-cell py-1">Cash Flow</TableHead>
                                <TableHead className="h-8 md:h-12 text-right text-[11px] md:text-sm text-muted-foreground px-2 md:px-4 py-1">Amount</TableHead>
                                <TableHead className="h-8 md:h-12 w-[30px] md:w-[80px] px-1 md:px-4 py-1"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-16 md:h-24 text-center text-xs md:text-sm text-muted-foreground">
                                        No transactions yet. Click 'New Entry' to add one.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.slice(0, 10).map((t) => (
                                    <TableRow key={t.id} className="border-border hover:bg-muted/50">
                                        <TableCell className="py-2 md:py-4 font-medium text-[11px] md:text-sm text-foreground/80 px-2 md:px-4">
                                            {format(parseISO(t.timestamp), 'dd/MM')}
                                        </TableCell>
                                        <TableCell className="py-2 md:py-4 px-2 md:px-4">
                                            <div className="flex flex-col">
                                                <Link to={`/edit/${t.id}`} className="text-xs md:text-base text-foreground hover:underline hover:text-primary font-semibold mb-0 md:mb-1">
                                                    {t.title}
                                                </Link>
                                                {/* On mobile, show the source as a small subtitle if it's hidden from the main column */}
                                                <span className="text-[9px] md:text-xs text-muted-foreground md:hidden mt-0.5">
                                                    {t.type === 'Transfer' ? `${t.source} → ${t.toSource}` : t.source}
                                                    {t.category ? ` • ${t.category}` : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 md:py-4 hidden md:table-cell">
                                            {t.type === 'Transfer' ? (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <span>{t.source}</span>
                                                    <span>→</span>
                                                    <span>{t.toSource}</span>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="border-border text-foreground bg-muted/50">{t.source}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2 md:py-4 hidden sm:table-cell">
                                            <div className="flex gap-2">
                                                <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted/80">{t.type}</Badge>
                                                {t.category && (
                                                    <Badge variant="outline" className={`border-border bg-muted/50 ${t.category === 'Need' ? 'text-secondary' : t.category === 'Want' ? 'text-primary' : 'text-foreground/80'}`}>
                                                        {t.category}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`py-2 md:py-4 text-right text-[11px] md:text-sm px-2 md:px-4 ${t.type === 'Transfer' ? 'text-secondary' : t.type === 'Debit' ? 'text-foreground' : t.type === 'Credit' ? 'text-primary' : t.amount > 0 ? 'text-primary' : 'text-foreground'}`}>
                                            {t.type === 'Transfer' ? '' : t.type === 'Debit' ? '-' : t.type === 'Credit' ? '+' : t.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                                        </TableCell>
                                        <TableCell className="py-2 md:py-4 text-right px-1 md:px-4">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(t.id)}
                                                title="Delete Transaction"
                                            >
                                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}

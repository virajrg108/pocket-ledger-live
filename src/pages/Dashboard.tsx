import { useCollectionData } from "react-firebase-hooks/firestore";
import { query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { getUserCollections } from "../db";
import { useAuthStore } from "../store/useAuthStore";
import { db as firestoreDb } from "../lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import React, { useRef, useState, useEffect } from "react";
import { Trash2, IndianRupee } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

const FitText = ({ children, className, align = "left" }: { children: React.ReactNode; className?: string; align?: "left" | "center" }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (!containerRef.current || !textRef.current) return;
            textRef.current.style.transform = 'scale(1)';
            const containerWidth = containerRef.current.clientWidth;
            const textWidth = textRef.current.scrollWidth;
            if (textWidth > containerWidth && textWidth > 0) {
                setScale(containerWidth / textWidth);
            } else {
                setScale(1);
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        return () => resizeObserver.disconnect();
    }, [children]);

    return (
        <div ref={containerRef} className={cn("flex items-center overflow-hidden whitespace-nowrap w-full", className)}>
            <div
                ref={textRef}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: align === "center" ? "center center" : "left center",
                    willChange: "transform"
                }}
            >
                {children}
            </div>
        </div>
    );
};

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
        const txSum = transactions.reduce((sum, t) => {
            if (t.type !== 'Transfer' && t.source === acc.name) {
                return sum + t.amount;
            }
            if (t.type === 'Transfer') {
                if (t.source === acc.name) return sum - t.amount;
                if (t.toSource === acc.name) return sum + t.amount;
            }
            return sum;
        }, 0);
        return accTotal + acc.initialBalance + txSum;
    }, 0);

    const handleDelete = async (id?: string) => {
        if (!id || !user) return;
        if (window.confirm("Are you sure you want to delete this transaction from your history?")) {
            await deleteDoc(doc(firestoreDb, 'users', user.uid, 'transactions', id));
        }
    };

    return (
        <div className="flex flex-col flex-1 p-2 md:p-8 space-y-4 animate-in fade-in duration-500">
            <div>
                <h2 className="text-lg md:text-3xl font-bold tracking-tight text-foreground">Overview</h2>
                <p className="text-muted-foreground text-sm md:text-lg">Your financial snapshot</p>
            </div>

            <Card className="gap-0 bg-gradient-to-r from-amber-400 to-orange-500 border-0 ring-0 text-black shadow-md mb-4 text-center">
                <CardHeader className="flex flex-row items-center justify-center pb-2">
                    <CardTitle className="text-base font-medium">Total Balance</CardTitle>
                </CardHeader>
                <CardContent>
                    <FitText align="center" className="justify-center text-2xl md:text-3xl font-bold tracking-tight">
                        {totalBalance < 0 ? '-' : ''}{formatCurrency(totalBalance)}
                    </FitText>
                </CardContent>
            </Card>

            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
                {accounts.map(acc => {
                    const txSum = transactions.reduce((sum, t) => {
                        if (t.type !== 'Transfer' && t.source === acc.name) {
                            return sum + t.amount;
                        }
                        if (t.type === 'Transfer') {
                            if (t.source === acc.name) return sum - t.amount;
                            if (t.toSource === acc.name) return sum + t.amount;
                        }
                        return sum;
                    }, 0);
                    const currentBalance = acc.initialBalance + txSum;

                    return (
                        <Card key={acc.id} className="gap-0 bg-card border border-border text-foreground shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium truncate pr-2">{acc.name}</CardTitle>
                                <IndianRupee className="w-4 h-4 shrink-0 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <FitText className={`text-xl font-bold ${currentBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                    {currentBalance < 0 ? '-' : ''}{formatCurrency(currentBalance)}
                                </FitText>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="bg-card border border-border text-foreground shadow-md">
                <CardHeader>
                    <CardTitle>Recent History</CardTitle>
                    <CardDescription className="text-muted-foreground">Your most recent local transactions.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader className="border-border">
                            <TableRow className="border-border hover:bg-muted/50">
                                <TableHead className="w-[60px] text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Title</TableHead>
                                <TableHead className="text-muted-foreground hidden md:table-cell">Source</TableHead>
                                <TableHead className="text-muted-foreground hidden sm:table-cell">Cash Flow</TableHead>
                                <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No transactions yet. Click 'New Entry' to add one.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.slice(0, 10).map((t) => (
                                    <TableRow key={t.id} className="border-border hover:bg-muted/50">
                                        <TableCell className="font-medium text-foreground/80">
                                            {format(parseISO(t.timestamp), 'dd/MM')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <Link to={`/edit/${t.id}`} className="text-foreground hover:underline hover:text-primary font-semibold mb-1">
                                                    {t.title}
                                                </Link>
                                                {/* On mobile, show the source as a small subtitle if it's hidden from the main column */}
                                                <span className="text-xs text-muted-foreground md:hidden">
                                                    {t.type === 'Transfer' ? `${t.source} → ${t.toSource}` : t.source}
                                                    {t.category ? ` • ${t.category}` : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
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
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="flex gap-2">
                                                <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted/80">{t.type}</Badge>
                                                {t.category && (
                                                    <Badge variant="outline" className={`border-border bg-muted/50 ${t.category === 'Need' ? 'text-secondary' : t.category === 'Want' ? 'text-primary' : 'text-foreground/80'}`}>
                                                        {t.category}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`text-right ${t.type === 'Transfer' ? 'text-secondary' : t.amount > 0 ? 'text-primary' : 'text-foreground'}`}>
                                            {t.type === 'Transfer' ? '' : t.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(t.id)}
                                                title="Delete Transaction"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

import { collection, type DocumentData, type QueryDocumentSnapshot, type SnapshotOptions } from 'firebase/firestore';
import { db as firestoreDb } from './lib/firebase';

export type TransactionType = 'Debit' | 'Credit' | 'Transfer';
export type TransactionSource = string;

export interface Transaction {
    id?: string;
    title: string;
    amount: number;
    type: TransactionType;
    source: TransactionSource;
    toSource?: TransactionSource;
    category?: 'Need' | 'Want' | 'Other';
    timestamp: string; // Stored as ISO string
}

export interface Account {
    id?: string;
    name: TransactionSource;
    initialBalance: number;
}

const transactionConverter = {
    toFirestore(tx: Transaction): DocumentData {
        const { id, ...data } = tx;
        return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Transaction {
        const data = snapshot.data(options);
        return { id: snapshot.id, ...data } as Transaction;
    }
};

const accountConverter = {
    toFirestore(acc: Account): DocumentData {
        const { id, ...data } = acc;
        return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Account {
        const data = snapshot.data(options);
        return { id: snapshot.id, ...data } as Account;
    }
};

// Utility function to get user-specific collections
export const getUserCollections = (userId: string | undefined) => {
    if (!userId) return null;
    return {
        transactions: collection(firestoreDb, 'users', userId, 'transactions').withConverter(transactionConverter),
        accounts: collection(firestoreDb, 'users', userId, 'accounts').withConverter(accountConverter)
    };
};

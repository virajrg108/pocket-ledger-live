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

export interface MerchantMapping {
    id?: string;
    merchantName: string;
    type: TransactionType;
    amount: number;
    title: string;
    category: 'Need' | 'Want' | 'Other' | string;
    updatedAt?: number;
}

export function buildRuleDocId(merchantName: string, type: string, amount: number): string {
    const cleanMerchant = (merchantName || 'Unknown').replace(/\//g, '_').trim();
    const cleanType = (type || 'Debit').trim();
    const rounded = Math.round((Number(amount) || 0) * 100) / 100;
    let cleanAmount = "0";
    if (rounded > 0) {
        const s = rounded.toString();
        cleanAmount = s.includes('.') ? s : s + '.0';
    }
    return `${cleanMerchant}_${cleanType}_${cleanAmount}`;
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

const merchantMappingConverter = {
    toFirestore(mapping: MerchantMapping): DocumentData {
        const { id, ...data } = mapping;
        return {
            ...data,
            amount: Math.round((Number(data.amount) || 0) * 100) / 100,
            updatedAt: data.updatedAt || Date.now()
        };
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): MerchantMapping {
        const data = snapshot.data(options);
        return {
            id: snapshot.id,
            merchantName: data.merchantName || '',
            type: (data.type || 'Debit') as TransactionType,
            amount: typeof data.amount === 'number' ? data.amount : 0,
            title: data.title || '',
            category: data.category || 'Need',
            updatedAt: data.updatedAt
        } as MerchantMapping;
    }
};

// Utility function to get user-specific collections
export const getUserCollections = (userId: string | undefined) => {
    if (!userId) return null;
    return {
        transactions: collection(firestoreDb, 'users', userId, 'transactions').withConverter(transactionConverter),
        accounts: collection(firestoreDb, 'users', userId, 'accounts').withConverter(accountConverter),
        merchantMappings: collection(firestoreDb, 'users', userId, 'merchant_mappings').withConverter(merchantMappingConverter)
    };
};

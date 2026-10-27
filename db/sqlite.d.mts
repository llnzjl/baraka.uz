export type QueryResult<R = any> = { rows: R[]; rowCount: number | null };
export interface DatabaseClient {
 query<R = any>(sql: string, values?: any[]): Promise<QueryResult<R>>;
 release(): void;
}
export interface DatabasePool {
 query<R = any>(sql: string, values?: any[]): Promise<QueryResult<R>>;
 connect(): Promise<DatabaseClient>;
 end(): Promise<void>;
}
export class SQLitePool implements DatabasePool {
 constructor(filename?: string);
 filename: string;
 query<R = any>(sql: string, values?: any[]): Promise<QueryResult<R>>;
 connect(): Promise<DatabaseClient>;
 end(): Promise<void>;
}
export function sqlitePath(): string;
export function sqliteSQL(input: string): string;

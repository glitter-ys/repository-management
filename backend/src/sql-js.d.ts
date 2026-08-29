// sql.js ships no TypeScript declarations; provide a minimal shim so tsc can build.
declare module 'sql.js' {
  export type Database = any;
  const initSqlJs: (config?: { wasmBinary?: ArrayBufferView; locateFile?: (file: string) => string }) => Promise<any>;
  export default initSqlJs;
}

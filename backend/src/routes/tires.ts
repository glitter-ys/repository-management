import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDb, saveDb } from '../models';

const router = Router();

function queryAll(sql: string, params: any[] = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql: string, params: any[] = []) {
  const db = getDb();
  db.run(sql, params);
  saveDb();
}

router.get('/', (req: Request, res: Response) => {
  const { brand, model, size, keyword } = req.query;
  let sql = 'SELECT id, brand, model, size, quantity, createdAt, updatedAt FROM tires WHERE 1=1';
  const params: any[] = [];

  if (keyword) {
    sql += ' AND (brand LIKE ? OR model LIKE ? OR size LIKE ?)';
    const k = `%${keyword}%`;
    params.push(k, k, k);
  }
  if (brand) { sql += ' AND brand = ?'; params.push(brand); }
  if (model) { sql += ' AND model = ?'; params.push(model); }
  if (size) { sql += ' AND size = ?'; params.push(size); }

  sql += ' ORDER BY updatedAt DESC';
  res.json({ success: true, data: queryAll(sql, params) });
});

router.get('/:id', (req: Request, res: Response) => {
  const row = queryOne('SELECT id, brand, model, size, quantity, createdAt, updatedAt FROM tires WHERE id = ?', [Number(req.params.id)]);
  if (!row) return res.status(404).json({ success: false, message: '轮胎不存在' });
  res.json({ success: true, data: row });
});

router.post('/', (req: Request, res: Response) => {
  const { brand, model, size, quantity } = req.body;
  if (!brand || !model || !size) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }
  const internalSku = `TIRE-${randomUUID()}`;
  run(
    "INSERT INTO tires (sku, brand, model, size, quantity, location, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))",
    [internalSku, brand, model, size, quantity || 0, '']
  );
  const tire = queryOne('SELECT id, brand, model, size, quantity, createdAt, updatedAt FROM tires WHERE sku = ?', [internalSku]);
  res.json({ success: true, data: tire });
});

router.put('/:id', (req: Request, res: Response) => {
  const { brand, model, size } = req.body;
  const existing = queryOne('SELECT * FROM tires WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ success: false, message: '轮胎不存在' });
  if (!brand || !model || !size) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  run(
    "UPDATE tires SET brand=?, model=?, size=?, updatedAt=datetime('now','localtime') WHERE id=?",
    [brand, model, size, Number(req.params.id)]
  );
  const tire = queryOne('SELECT id, brand, model, size, quantity, createdAt, updatedAt FROM tires WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true, data: tire });
});

router.delete('/:id', (req: Request, res: Response) => {
  const existing = queryOne('SELECT * FROM tires WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ success: false, message: '轮胎不存在' });
  run('DELETE FROM stock_records WHERE tireId = ?', [Number(req.params.id)]);
  run('DELETE FROM tires WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true, message: '删除成功' });
});

export default router;

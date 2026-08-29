import { Router, Request, Response } from 'express';
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

router.get('/records', (req: Request, res: Response) => {
  const { tireId, type } = req.query;
  let sql = `
    SELECT sr.id, sr.tireId, sr.type, sr.quantity, sr.stockInTime, sr.stockOutTime,
           sr.unitPrice, sr.recipient, sr.remark, sr.createdAt,
           t.brand, t.model, t.size
    FROM stock_records sr
    LEFT JOIN tires t ON sr.tireId = t.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (tireId) { sql += ' AND sr.tireId = ?'; params.push(Number(tireId)); }
  if (type) { sql += ' AND sr.type = ?'; params.push(type); }
  sql += ' ORDER BY sr.createdAt DESC';
  res.json({ success: true, data: queryAll(sql, params) });
});

router.post('/in', (req: Request, res: Response) => {
  const { tireId, quantity, stockInTime, unitPrice, remark } = req.body;
  const parsedUnitPrice = Number(unitPrice);
  if (!tireId || !quantity || quantity <= 0 || !stockInTime || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  const tire = queryOne('SELECT id, quantity FROM tires WHERE id = ?', [tireId]);
  if (!tire) return res.status(404).json({ success: false, message: '轮胎不存在' });

  run(
    "INSERT INTO stock_records (tireId, type, quantity, stockInTime, unitPrice, remark, createdAt) VALUES (?, 'IN', ?, ?, ?, ?, datetime('now','localtime'))",
    [tireId, quantity, stockInTime, parsedUnitPrice, remark || '']
  );
  run("UPDATE tires SET quantity = quantity + ?, updatedAt = datetime('now','localtime') WHERE id = ?", [quantity, tireId]);
  const updated = queryOne('SELECT id, brand, model, size, quantity, createdAt, updatedAt FROM tires WHERE id = ?', [tireId]);
  res.json({ success: true, data: updated });
});

router.post('/out', (req: Request, res: Response) => {
  const { tireId, quantity, stockOutTime, recipient, unitPrice, remark } = req.body;
  const parsedUnitPrice = Number(unitPrice);
  if (!tireId || !quantity || quantity <= 0 || !stockOutTime || !recipient || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  const tire = queryOne('SELECT id, quantity FROM tires WHERE id = ?', [tireId]) as any;
  if (!tire) return res.status(404).json({ success: false, message: '轮胎不存在' });
  if (tire.quantity < quantity) {
    return res.status(400).json({ success: false, message: '库存不足' });
  }

  run(
    "INSERT INTO stock_records (tireId, type, quantity, stockOutTime, recipient, unitPrice, remark, createdAt) VALUES (?, 'OUT', ?, ?, ?, ?, ?, datetime('now','localtime'))",
    [tireId, quantity, stockOutTime, recipient, parsedUnitPrice, remark || '']
  );
  run("UPDATE tires SET quantity = quantity - ?, updatedAt = datetime('now','localtime') WHERE id = ?", [quantity, tireId]);
  const updated = queryOne('SELECT id, brand, model, size, quantity, createdAt, updatedAt FROM tires WHERE id = ?', [tireId]);
  res.json({ success: true, data: updated });
});

router.put('/records/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { type, quantity, date, unitPrice, recipient, remark } = req.body;
  const qty = Number(quantity);
  const price = Number(unitPrice);
  if (type !== 'IN' && type !== 'OUT') {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  if (!qty || qty <= 0 || !date || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  if (type === 'OUT' && !recipient) {
    return res.status(400).json({ success: false, message: '请填写收货人' });
  }

  const record = queryOne('SELECT id, tireId, type, quantity FROM stock_records WHERE id = ?', [id]) as any;
  if (!record) return res.status(404).json({ success: false, message: '记录不存在' });
  const tire = queryOne('SELECT id, quantity FROM tires WHERE id = ?', [record.tireId]) as any;
  if (!tire) return res.status(404).json({ success: false, message: '轮胎不存在' });

  // Reverse the record's old effect on inventory, then apply the new effect.
  const oldEffect = record.type === 'IN' ? record.quantity : -record.quantity;
  const newEffect = type === 'IN' ? qty : -qty;
  const newTireQty = tire.quantity - oldEffect + newEffect;
  if (newTireQty < 0) {
    return res.status(400).json({ success: false, message: '库存不足，无法修改' });
  }

  const stockInTime = type === 'IN' ? date : '';
  const stockOutTime = type === 'OUT' ? date : '';
  const newRecipient = type === 'OUT' ? recipient : '';

  run(
    'UPDATE stock_records SET type=?, quantity=?, stockInTime=?, stockOutTime=?, unitPrice=?, recipient=?, remark=? WHERE id=?',
    [type, qty, stockInTime, stockOutTime, price, newRecipient, remark || '', id]
  );
  run("UPDATE tires SET quantity=?, updatedAt=datetime('now','localtime') WHERE id=?", [newTireQty, record.tireId]);
  res.json({ success: true, message: '修改成功' });
});

router.delete('/records/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const record = queryOne('SELECT id, tireId, type, quantity FROM stock_records WHERE id = ?', [id]) as any;
  if (!record) return res.status(404).json({ success: false, message: '记录不存在' });

  const tire = queryOne('SELECT id, quantity FROM tires WHERE id = ?', [record.tireId]) as any;
  if (tire) {
    if (record.type === 'IN') {
      if (tire.quantity < record.quantity) {
        return res.status(400).json({ success: false, message: '当前库存不足，无法撤销该入库记录' });
      }
      run("UPDATE tires SET quantity = quantity - ?, updatedAt = datetime('now','localtime') WHERE id = ?", [record.quantity, record.tireId]);
    } else {
      run("UPDATE tires SET quantity = quantity + ?, updatedAt = datetime('now','localtime') WHERE id = ?", [record.quantity, record.tireId]);
    }
  }
  run('DELETE FROM stock_records WHERE id = ?', [id]);
  res.json({ success: true, message: '撤销成功' });
});

router.get('/inventory-checks', (_req: Request, res: Response) => {
  const rows = queryAll('SELECT * FROM inventory_checks ORDER BY createdAt DESC');
  const data = rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
  res.json({ success: true, data });
});

router.post('/inventory-check', (req: Request, res: Response) => {
  const { checkDate, items, operator } = req.body;
  if (!checkDate || !items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }

  for (const item of items) {
    if (item.actualQuantity !== undefined && item.tireId) {
      run("UPDATE tires SET quantity = ?, updatedAt = datetime('now','localtime') WHERE id = ?",
        [item.actualQuantity, item.tireId]);
    }
  }
  run('INSERT INTO inventory_checks (checkDate, items, operator) VALUES (?, ?, ?)',
    [checkDate, JSON.stringify(items), operator || '']);
  res.json({ success: true, message: '盘点完成' });
});

// Edit a single tire's actual count within a check; apply the delta to current stock.
router.put('/inventory-check/:checkId/item/:tireId', (req: Request, res: Response) => {
  const checkId = Number(req.params.checkId);
  const tireId = Number(req.params.tireId);
  const actual = Number(req.body.actualQuantity);
  if (!Number.isFinite(actual) || actual < 0) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  const check = queryOne('SELECT id, items FROM inventory_checks WHERE id = ?', [checkId]) as any;
  if (!check) return res.status(404).json({ success: false, message: '盘点记录不存在' });
  const items = JSON.parse(check.items);
  const item = items.find((i: any) => Number(i.tireId) === tireId);
  if (!item) return res.status(404).json({ success: false, message: '盘点明细不存在' });
  const tire = queryOne('SELECT id, quantity FROM tires WHERE id = ?', [tireId]) as any;
  if (!tire) return res.status(404).json({ success: false, message: '轮胎不存在' });

  const oldActual = Number(item.actualQuantity ?? item.systemQuantity ?? 0);
  const newTireQty = tire.quantity + (actual - oldActual);
  if (newTireQty < 0) {
    return res.status(400).json({ success: false, message: '库存不足，无法修改' });
  }
  item.actualQuantity = actual;
  item.diff = actual - Number(item.systemQuantity ?? 0);
  run('UPDATE inventory_checks SET items = ? WHERE id = ?', [JSON.stringify(items), checkId]);
  run("UPDATE tires SET quantity = ?, updatedAt = datetime('now','localtime') WHERE id = ?", [newTireQty, tireId]);
  res.json({ success: true, message: '修改成功' });
});

// Revoke a single tire's adjustment within a check: roll back the diff from current stock.
router.delete('/inventory-check/:checkId/item/:tireId', (req: Request, res: Response) => {
  const checkId = Number(req.params.checkId);
  const tireId = Number(req.params.tireId);
  const check = queryOne('SELECT id, items FROM inventory_checks WHERE id = ?', [checkId]) as any;
  if (!check) return res.status(404).json({ success: false, message: '盘点记录不存在' });
  const items = JSON.parse(check.items);
  const item = items.find((i: any) => Number(i.tireId) === tireId);
  if (!item) return res.status(404).json({ success: false, message: '盘点明细不存在' });

  const system = Number(item.systemQuantity ?? 0);
  const diff = item.diff !== undefined ? Number(item.diff) : Number(item.actualQuantity ?? 0) - system;
  const tire = queryOne('SELECT id, quantity FROM tires WHERE id = ?', [tireId]) as any;
  if (tire) {
    const newTireQty = tire.quantity - diff;
    if (newTireQty < 0) {
      return res.status(400).json({ success: false, message: '当前库存不足，无法撤销该盘点' });
    }
    run("UPDATE tires SET quantity = ?, updatedAt = datetime('now','localtime') WHERE id = ?", [newTireQty, tireId]);
  }
  // Neutralize the item so it no longer shows as an adjustment.
  item.actualQuantity = system;
  item.diff = 0;
  run('UPDATE inventory_checks SET items = ? WHERE id = ?', [JSON.stringify(items), checkId]);
  res.json({ success: true, message: '撤销成功' });
});

router.get('/stats', (_req: Request, res: Response) => {
  const totalProducts = queryOne('SELECT COUNT(*) as count FROM tires')?.count || 0;
  const totalQuantity = queryOne('SELECT COALESCE(SUM(quantity),0) as total FROM tires')?.total || 0;
  // 库存金额:按先进先出(FIFO)估值。出库默认先扣最早入库的货,因此当前库存视为
  // 最近几批入库的货,从最新入库往回累加、各批 × 各自进价,直到凑够当前库存量。
  const tireQuantities = queryAll('SELECT id, quantity FROM tires');
  const inBatchesByTire = new Map<number, { quantity: number; unitPrice: number }[]>();
  for (const rec of queryAll("SELECT tireId, quantity, unitPrice FROM stock_records WHERE type='IN' ORDER BY tireId, id DESC")) {
    const list = inBatchesByTire.get(rec.tireId) || [];
    list.push({ quantity: rec.quantity, unitPrice: rec.unitPrice });
    inBatchesByTire.set(rec.tireId, list);
  }
  let totalAmount = 0;
  for (const tire of tireQuantities) {
    let remaining = tire.quantity;
    for (const batch of inBatchesByTire.get(tire.id) || []) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.quantity);
      totalAmount += take * batch.unitPrice;
      remaining -= take;
    }
  }
  const todayIn = queryOne(
    "SELECT COALESCE(SUM(quantity),0) as total FROM stock_records WHERE type='IN' AND date(COALESCE(NULLIF(stockInTime, ''), createdAt))=date('now','localtime')"
  )?.total || 0;
  const todayOut = queryOne(
    "SELECT COALESCE(SUM(quantity),0) as total FROM stock_records WHERE type='OUT' AND date(COALESCE(NULLIF(stockOutTime, ''), createdAt))=date('now','localtime')"
  )?.total || 0;
  const monthlyIn = queryOne(
    "SELECT COALESCE(SUM(quantity),0) as total FROM stock_records WHERE type='IN' AND strftime('%Y-%m', COALESCE(NULLIF(stockInTime, ''), createdAt))=strftime('%Y-%m','now','localtime')"
  )?.total || 0;
  const monthlyOut = queryOne(
    "SELECT COALESCE(SUM(quantity),0) as total FROM stock_records WHERE type='OUT' AND strftime('%Y-%m', COALESCE(NULLIF(stockOutTime, ''), createdAt))=strftime('%Y-%m','now','localtime')"
  )?.total || 0;
  const monthlyInAmount = queryOne(
    "SELECT COALESCE(SUM(quantity*unitPrice),0) as total FROM stock_records WHERE type='IN' AND strftime('%Y-%m', COALESCE(NULLIF(stockInTime, ''), createdAt))=strftime('%Y-%m','now','localtime')"
  )?.total || 0;
  const monthlyOutAmount = queryOne(
    "SELECT COALESCE(SUM(quantity*unitPrice),0) as total FROM stock_records WHERE type='OUT' AND strftime('%Y-%m', COALESCE(NULLIF(stockOutTime, ''), createdAt))=strftime('%Y-%m','now','localtime')"
  )?.total || 0;
  const brandStats = queryAll('SELECT brand, SUM(quantity) as total FROM tires GROUP BY brand ORDER BY total DESC');
  const productStats = queryAll(`
    SELECT id, brand, model, size, quantity AS total
    FROM tires
    WHERE quantity > 0
    ORDER BY quantity DESC
  `);

  res.json({
    success: true,
    data: { totalProducts, totalQuantity, totalAmount, todayIn, todayOut, monthlyIn, monthlyOut, monthlyInAmount, monthlyOutAmount, brandStats, productStats }
  });
});

export default router;

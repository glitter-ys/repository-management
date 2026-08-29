import { useState, useEffect } from 'react';
import { Table, Button, InputNumber, Input, message, Card } from 'antd';
import dayjs from 'dayjs';
import { tireApi, stockApi } from '../services/api';
import type { Tire } from '../services/api';

export default function InventoryCheck() {
  const [tires, setTires] = useState<Tire[]>([]);
  const [checkData, setCheckData] = useState<Record<number, number>>({});
  const [operator, setOperator] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    tireApi.list().then(res => {
      setTires(res.data.data);
      const initial: Record<number, number> = {};
      res.data.data.forEach((t: Tire) => { initial[t.id] = t.quantity; });
      setCheckData(initial);
    });
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const items = tires.map(t => ({
        tireId: t.id,
        brand: t.brand,
        model: t.model,
        size: t.size,
        systemQuantity: t.quantity,
        actualQuantity: checkData[t.id] ?? t.quantity,
        diff: (checkData[t.id] ?? t.quantity) - t.quantity,
      }));
      await stockApi.createCheck({
        checkDate: dayjs().format('YYYY-MM-DD'),
        items,
        operator,
      });
      message.success('盘点完成');
      tireApi.list().then(res => {
        setTires(res.data.data);
        const initial: Record<number, number> = {};
        res.data.data.forEach((t: Tire) => { initial[t.id] = t.quantity; });
        setCheckData(initial);
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 100 },
    { title: '规格', dataIndex: 'size', key: 'size', width: 120 },
    { title: '系统数量', dataIndex: 'quantity', key: 'quantity', width: 100 },
    {
      title: '实际数量', key: 'actual', width: 120,
      render: (_: unknown, record: Tire) => (
        <InputNumber
          min={0}
          value={checkData[record.id] ?? record.quantity}
          onChange={val => setCheckData(prev => ({ ...prev, [record.id]: val ?? 0 }))}
        />
      ),
    },
    {
      title: '差异', key: 'diff', width: 80,
      render: (_: unknown, record: Tire) => {
        const diff = (checkData[record.id] ?? record.quantity) - record.quantity;
        return <span style={{ color: diff === 0 ? 'inherit' : diff > 0 ? 'green' : 'red' }}>{diff}</span>;
      },
    },
  ];

  return (
    <Card title={`库存盘点 - ${dayjs().format('YYYY-MM-DD')}`}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>操作人：</span>
        <Input value={operator} onChange={e => setOperator(e.target.value)} style={{ width: 200 }} />
        <Button type="primary" onClick={handleSubmit} loading={loading} style={{ marginLeft: 'auto' }}>
          提交盘点
        </Button>
      </div>
      <Table columns={columns} dataSource={tires} rowKey="id" pagination={false} scroll={{ x: 700 }} />
    </Card>
  );
}

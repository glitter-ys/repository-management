import { useState, useEffect } from 'react';
import { Table, Tag, Select, DatePicker, Button, Popconfirm, Modal, Form, InputNumber, Input, message } from 'antd';
import { UndoOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { getApiErrorMessage, stockApi } from '../services/api';
import type { InventoryCheck, StockRecord } from '../services/api';

interface RecordFormValues {
  type: 'IN' | 'OUT';
  quantity: number;
  date: Dayjs;
  unitPrice: number;
  recipient?: string;
  remark?: string;
}

// A row in the merged list: either a real stock movement, or a 盘点 adjustment
// synthesized from an inventory check item whose actual quantity differed.
type DisplayRecord = Omit<StockRecord, 'type'> & {
  type: 'IN' | 'OUT' | 'CHECK';
  rowKey: string;
  isCheck: boolean;
  checkId?: number;
  systemQuantity?: number;
  actualQuantity?: number;
  operator?: string;
};

const TYPE_META: Record<DisplayRecord['type'], { color: string; label: string }> = {
  IN: { color: 'green', label: '入库' },
  OUT: { color: 'red', label: '出库' },
  CHECK: { color: 'blue', label: '盘点' },
};

const toOptions = (values: (string | undefined)[]) =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v))))
    .sort((a, b) => a.localeCompare(b, 'zh'))
    .map(value => ({ value, label: value }));

export default function StockRecords() {
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [editing, setEditing] = useState<StockRecord | null>(null);
  const [editingCheck, setEditingCheck] = useState<DisplayRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [form] = Form.useForm<RecordFormValues>();
  const [checkForm] = Form.useForm<{ actualQuantity: number }>();
  const editType = Form.useWatch('type', form);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, checkRes] = await Promise.all([stockApi.records(), stockApi.inventoryChecks()]);
      setRecords(recRes.data.data);
      setChecks(checkRes.data.data);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '获取记录失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRevoke = async (id: number) => {
    try {
      await stockApi.revokeRecord(id);
      message.success('撤销成功');
      fetchData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '撤销失败'));
    }
  };

  const handleRevokeCheck = async (record: DisplayRecord) => {
    if (!record.checkId) return;
    try {
      await stockApi.revokeCheckItem(record.checkId, record.tireId);
      message.success('撤销成功');
      fetchData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '撤销失败'));
    }
  };

  const handleReset = () => {
    setTypeFilter([]);
    setBrandFilter([]);
    setModelFilter([]);
    setSizeFilter([]);
    setRecipientFilter([]);
    setDateRange(null);
  };

  const handleEdit = (record: StockRecord) => {
    setEditing(record);
    const dateStr = record.type === 'IN' ? record.stockInTime : record.stockOutTime;
    form.setFieldsValue({
      type: record.type,
      quantity: record.quantity,
      date: dateStr ? dayjs(dateStr) : undefined,
      unitPrice: Number(record.unitPrice) || undefined,
      recipient: record.recipient || undefined,
      remark: record.remark || undefined,
    });
  };

  const handleSave = async () => {
    let values: RecordFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (!editing) return;
    setSaving(true);
    try {
      await stockApi.updateRecord(editing.id, {
        type: values.type,
        quantity: values.quantity,
        date: values.date.format('YYYY-MM-DD'),
        unitPrice: values.unitPrice,
        recipient: values.type === 'OUT' ? values.recipient : undefined,
        remark: values.remark,
      });
      message.success('修改成功');
      setEditing(null);
      fetchData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '修改失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditCheck = (record: DisplayRecord) => {
    setEditingCheck(record);
    checkForm.setFieldsValue({ actualQuantity: record.actualQuantity ?? 0 });
  };

  const handleSaveCheck = async () => {
    let values: { actualQuantity: number };
    try {
      values = await checkForm.validateFields();
    } catch {
      return;
    }
    if (!editingCheck?.checkId) return;
    setSavingCheck(true);
    try {
      await stockApi.updateCheckItem(editingCheck.checkId, editingCheck.tireId, {
        actualQuantity: values.actualQuantity,
      });
      message.success('修改成功');
      setEditingCheck(null);
      fetchData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '修改失败'));
    } finally {
      setSavingCheck(false);
    }
  };

  // Merge real stock movements with 盘点 adjustments (only items whose quantity changed).
  const stockRows: DisplayRecord[] = records.map(r => ({ ...r, rowKey: `rec-${r.id}`, isCheck: false }));
  const checkRows: DisplayRecord[] = checks.flatMap(check =>
    check.items
      .map(item => {
        const system = Number(item.systemQuantity ?? 0);
        const actual = Number(item.actualQuantity ?? system);
        const diff = item.diff !== undefined ? Number(item.diff) : actual - system;
        return { item, system, actual, diff };
      })
      .filter(x => x.diff !== 0)
      .map(({ item, system, actual, diff }) => ({
        id: 0,
        rowKey: `check-${check.id}-${item.tireId}`,
        isCheck: true,
        checkId: check.id,
        tireId: Number(item.tireId),
        type: 'CHECK' as const,
        quantity: diff,
        stockInTime: '',
        stockOutTime: '',
        unitPrice: 0,
        recipient: '',
        remark: '',
        createdAt: check.createdAt || check.checkDate,
        brand: item.brand ? String(item.brand) : undefined,
        model: item.model ? String(item.model) : undefined,
        size: item.size ? String(item.size) : undefined,
        systemQuantity: system,
        actualQuantity: actual,
        operator: check.operator,
      }))
  );

  const allRows = [...stockRows, ...checkRows].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  const brandOptions = toOptions(allRows.map(r => r.brand));
  const modelOptions = toOptions(allRows.map(r => r.model));
  const sizeOptions = toOptions(allRows.map(r => r.size));
  const recipientOptions = toOptions(allRows.filter(r => r.type === 'OUT').map(r => r.recipient));

  const start = dateRange?.[0]?.format('YYYY-MM-DD');
  const end = dateRange?.[1]?.format('YYYY-MM-DD');
  const filteredRecords = allRows.filter(record => {
    if (typeFilter.length && !typeFilter.includes(record.type)) return false;
    if (brandFilter.length && !(record.brand && brandFilter.includes(record.brand))) return false;
    if (modelFilter.length && !(record.model && modelFilter.includes(record.model))) return false;
    if (sizeFilter.length && !(record.size && sizeFilter.includes(record.size))) return false;
    if (recipientFilter.length && !(record.recipient && recipientFilter.includes(record.recipient))) return false;
    if (start && end) {
      const day = (record.createdAt || '').slice(0, 10);
      if (day < start || day > end) return false;
    }
    return true;
  });

  // Totals over the current filter (盘点 has no price and is excluded).
  const inTotal = filteredRecords
    .filter(r => r.type === 'IN')
    .reduce((sum, r) => sum + r.quantity * Number(r.unitPrice || 0), 0);
  const outTotal = filteredRecords
    .filter(r => r.type === 'OUT')
    .reduce((sum, r) => sum + r.quantity * Number(r.unitPrice || 0), 0);

  const columns = [
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 100 },
    { title: '规格', dataIndex: 'size', key: 'size', width: 120 },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (type: DisplayRecord['type']) => {
        const meta = TYPE_META[type];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80,
      render: (value: number, record: DisplayRecord) =>
        record.isCheck ? `${value > 0 ? '+' : ''}${value}` : value,
    },
    {
      title: '入库日期', dataIndex: 'stockInTime', key: 'stockInTime', width: 120,
      render: (value: string, record: DisplayRecord) => record.type === 'IN' ? (value || '-') : '-',
    },
    {
      title: '出库日期', dataIndex: 'stockOutTime', key: 'stockOutTime', width: 120,
      render: (value: string, record: DisplayRecord) => record.type === 'OUT' ? (value || '-') : '-',
    },
    {
      title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 110,
      render: (value: number, record: DisplayRecord) => (
        !record.isCheck && Number(value) > 0 ? `¥${Number(value).toFixed(2)}` : '-'
      ),
    },
    {
      title: '总价', key: 'totalPrice', width: 120,
      render: (_: unknown, record: DisplayRecord) => (
        !record.isCheck && Number(record.unitPrice) > 0
          ? `¥${(record.quantity * Number(record.unitPrice)).toFixed(2)}`
          : '-'
      ),
    },
    {
      title: '收货人', dataIndex: 'recipient', key: 'recipient', width: 100,
      render: (value: string, record: DisplayRecord) => record.type === 'OUT' ? (value || '-') : '-',
    },
    {
      title: '操作时间', dataIndex: 'createdAt', key: 'createdAt', width: 120,
      render: (value: string) => (value || '').slice(0, 10) || '-',
    },
    {
      title: '备注', dataIndex: 'remark', key: 'remark', width: 200,
      render: (value: string, record: DisplayRecord) => (
        record.isCheck
          ? `系统 ${record.systemQuantity} → 实际 ${record.actualQuantity}${record.operator ? `（操作人：${record.operator}）` : ''}`
          : (value || '-')
      ),
    },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right' as const,
      render: (_: unknown, record: DisplayRecord) => (
        record.isCheck ? (
          <div style={{ display: 'flex', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
            <Button type="link" icon={<EditOutlined />} style={{ padding: '0 4px' }} onClick={() => handleEditCheck(record)}>编辑</Button>
            <Popconfirm
              title="确认撤销该盘点?"
              description="撤销将回滚本次盘点对库存的调整"
              onConfirm={() => handleRevokeCheck(record)}
            >
              <Button type="link" danger icon={<UndoOutlined />} style={{ padding: '0 4px' }}>撤销</Button>
            </Popconfirm>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
            <Button type="link" icon={<EditOutlined />} style={{ padding: '0 4px' }} onClick={() => handleEdit(record as StockRecord)}>编辑</Button>
            <Popconfirm
              title="确认撤销该记录?"
              description="撤销将回滚对应的库存变动"
              onConfirm={() => handleRevoke(record.id)}
            >
              <Button type="link" danger icon={<UndoOutlined />} style={{ padding: '0 4px' }}>撤销</Button>
            </Popconfirm>
          </div>
        )
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Select
          mode="multiple"
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="类型（可多选）"
          style={{ minWidth: 150 }}
          maxTagCount="responsive"
          allowClear
          options={[
            { value: 'IN', label: '入库' },
            { value: 'OUT', label: '出库' },
            { value: 'CHECK', label: '盘点' },
          ]}
        />
        <Select
          mode="multiple"
          value={brandFilter}
          onChange={setBrandFilter}
          placeholder="品牌（可多选）"
          style={{ minWidth: 180 }}
          maxTagCount="responsive"
          allowClear
          options={brandOptions}
        />
        <Select
          mode="multiple"
          value={modelFilter}
          onChange={setModelFilter}
          placeholder="型号（可多选）"
          style={{ minWidth: 180 }}
          maxTagCount="responsive"
          allowClear
          options={modelOptions}
        />
        <Select
          mode="multiple"
          value={sizeFilter}
          onChange={setSizeFilter}
          placeholder="规格（可多选）"
          style={{ minWidth: 180 }}
          maxTagCount="responsive"
          allowClear
          options={sizeOptions}
        />
        <Select
          mode="multiple"
          value={recipientFilter}
          onChange={setRecipientFilter}
          placeholder="收货人（可多选）"
          style={{ minWidth: 180 }}
          maxTagCount="responsive"
          allowClear
          options={recipientOptions}
        />
        <DatePicker.RangePicker
          value={dateRange}
          onChange={value => setDateRange(value as [Dayjs | null, Dayjs | null] | null)}
          placeholder={['开始日期', '结束日期']}
          format="YYYY-MM-DD"
        />
        <Button onClick={handleReset}>重置</Button>
      </div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 15 }}>
        <span>入库总金额：<strong style={{ color: '#26815b' }}>¥{inTotal.toFixed(2)}</strong></span>
        <span>出库总金额：<strong style={{ color: '#b8433f' }}>¥{outTotal.toFixed(2)}</strong></span>
      </div>
      <Table
        columns={columns}
        dataSource={filteredRecords}
        rowKey="rowKey"
        loading={loading}
        scroll={{ x: 1450 }}
        locale={{ emptyText: '暂无出入库记录' }}
      />
      <Modal
        title="编辑记录"
        open={!!editing}
        onOk={handleSave}
        onCancel={() => setEditing(null)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <div style={{ marginBottom: 16, color: '#666' }}>
          商品：{editing ? `${editing.brand ?? ''} ${editing.model ?? ''} ${editing.size ?? ''}`.trim() : ''}
        </div>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { value: 'IN', label: '入库' },
                { value: 'OUT', label: '出库' },
              ]}
            />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="date" label={editType === 'OUT' ? '出库日期' : '入库日期'} rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="unitPrice" label={editType === 'OUT' ? '卖出单价（¥）' : '商品单价（¥）'} rules={[{ required: true, message: '请输入单价' }]}>
            <InputNumber min={0.01} step={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          {editType === 'OUT' && (
            <Form.Item name="recipient" label="收货人" rules={[{ required: true, message: '请输入收货人' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="编辑盘点"
        open={!!editingCheck}
        onOk={handleSaveCheck}
        onCancel={() => setEditingCheck(null)}
        confirmLoading={savingCheck}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <div style={{ marginBottom: 16, color: '#666' }}>
          商品：{editingCheck ? `${editingCheck.brand ?? ''} ${editingCheck.model ?? ''} ${editingCheck.size ?? ''}`.trim() : ''}
          <div>系统数量：{editingCheck?.systemQuantity}</div>
        </div>
        <Form form={checkForm} layout="vertical" preserve={false}>
          <Form.Item name="actualQuantity" label="实际数量" rules={[{ required: true, message: '请输入实际数量' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

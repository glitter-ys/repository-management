import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Drawer, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import { getApiErrorMessage, stockApi, tireApi } from '../services/api';
import type { StockRecord, Tire } from '../services/api';

interface TireFormValues {
  brand: string;
  model: string;
  size: string;
  quantity?: number;
}

export default function TireList() {
  const [tires, setTires] = useState<Tire[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTire, setEditingTire] = useState<Tire | null>(null);
  const [keyword, setKeyword] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTire, setHistoryTire] = useState<Tire | null>(null);
  const [historyRecords, setHistoryRecords] = useState<StockRecord[]>([]);
  const [form] = Form.useForm<TireFormValues>();

  const fetchTires = async () => {
    setLoading(true);
    try {
      const res = await tireApi.list(keyword ? { keyword } : undefined);
      setTires(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    tireApi.list().then(res => setTires(res.data.data)).finally(() => setLoading(false));
  }, []);

  const handleSearch = () => fetchTires();

  const handleAdd = () => {
    setEditingTire(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (tire: Tire) => {
    setEditingTire(tire);
    form.setFieldsValue(tire);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    await tireApi.delete(id);
    message.success('删除成功');
    fetchTires();
  };

  const handleViewHistory = async (tire: Tire) => {
    setHistoryTire(tire);
    setHistoryRecords([]);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await stockApi.records({ tireId: tire.id });
      setHistoryRecords(res.data.data);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '获取出入库记录失败'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editingTire) {
      await tireApi.update(editingTire.id, values);
      message.success('更新成功');
    } else {
      await tireApi.create(values);
      message.success('添加成功');
    }
    setModalOpen(false);
    fetchTires();
  };

  const columns = [
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 120 },
    { title: '规格', dataIndex: 'size', key: 'size', width: 120 },
    { title: '库存数量', dataIndex: 'quantity', key: 'quantity', width: 100 },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
    {
      title: '操作', key: 'action', width: 280,
      render: (_: unknown, record: Tire) => (
        <Space>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => handleViewHistory(record)}>出入库记录</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (type: StockRecord['type']) => (
        <Tag color={type === 'IN' ? 'green' : 'red'}>{type === 'IN' ? '入库' : '出库'}</Tag>
      ),
    },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    {
      title: '日期', key: 'recordDate', width: 120,
      render: (_: unknown, record: StockRecord) => (
        record.type === 'IN' ? (record.stockInTime || '-') : (record.stockOutTime || '-')
      ),
    },
    {
      title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 110,
      render: (value: number) => Number(value) > 0 ? `¥${Number(value).toFixed(2)}` : '-',
    },
    {
      title: '收货人', dataIndex: 'recipient', key: 'recipient', width: 110,
      render: (value: string, record: StockRecord) => record.type === 'OUT' ? (value || '-') : '-',
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 160 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          placeholder="搜索品牌/型号/规格"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
        />
        <Button type="primary" onClick={handleSearch}>搜索</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginLeft: 'auto' }}>
          新增轮胎
        </Button>
      </div>
      <Table columns={columns} dataSource={tires} rowKey="id" loading={loading} scroll={{ x: 800 }} />
      <Modal
        title={editingTire ? '编辑轮胎' : '新增轮胎'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="brand" label="品牌" rules={[{ required: true, message: '请输入品牌' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="model" label="型号" rules={[{ required: true, message: '请输入型号' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="size" label="规格" rules={[{ required: true, message: '请输入规格' }]}>
            <Input placeholder="如: 225/55R17" />
          </Form.Item>
          {!editingTire && (
            <Form.Item name="quantity" label="初始数量" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Drawer
        title={historyTire ? `${historyTire.brand} ${historyTire.model} ${historyTire.size} · 出入库记录` : '出入库记录'}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        width="min(820px, 100vw)"
      >
        <Table
          columns={historyColumns}
          dataSource={historyRecords}
          rowKey="id"
          loading={historyLoading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 660 }}
          locale={{ emptyText: '暂无出入库记录' }}
        />
      </Drawer>
    </div>
  );
}

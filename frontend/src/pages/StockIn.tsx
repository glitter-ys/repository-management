import { useState, useEffect } from 'react';
import { Form, Select, InputNumber, Input, Button, message, Card, DatePicker } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getApiErrorMessage, tireApi, stockApi } from '../services/api';
import type { Tire } from '../services/api';
import './StockOperation.css';

interface StockInFormValues {
  tireId: number;
  quantity: number;
  stockInTime: Dayjs;
  unitPrice: number;
  remark?: string;
}

export default function StockIn() {
  const [tires, setTires] = useState<Tire[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    tireApi.list().then(res => setTires(res.data.data));
  }, []);

  const handleSubmit = async (values: StockInFormValues) => {
    setLoading(true);
    try {
      await stockApi.stockIn({
        ...values,
        stockInTime: values.stockInTime.format('YYYY-MM-DD'),
      });
      message.success('入库成功');
      form.resetFields();
      form.setFieldValue('stockInTime', dayjs());
      tireApi.list().then(res => setTires(res.data.data));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '入库失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stock-operation-page stock-operation-in">
      <Card
        className="stock-operation-card"
        title={(
          <div className="stock-operation-heading">
            <span className="stock-operation-icon"><ImportOutlined /></span>
            <span>
              <strong>轮胎入库</strong>
              <small>记录到货数量、日期与采购单价</small>
            </span>
          </div>
        )}
      >
      <Form className="stock-operation-form" form={form} layout="vertical" size="large" onFinish={handleSubmit} initialValues={{ stockInTime: dayjs() }}>
        <Form.Item name="tireId" label="选择轮胎" rules={[{ required: true, message: '请选择轮胎' }]}>
          <Select
            showSearch
            placeholder="搜索并选择轮胎"
            optionFilterProp="label"
            options={tires.map(t => ({
              value: t.id,
              label: `${t.brand} ${t.model} ${t.size} (库存: ${t.quantity})`,
            }))}
          />
        </Form.Item>
        <div className="stock-operation-grid">
          <Form.Item name="quantity" label="入库数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} placeholder="请输入入库数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stockInTime" label="入库日期" rules={[{ required: true, message: '请选择入库日期' }]}>
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="unitPrice" label="商品单价" rules={[{ required: true, message: '请输入商品单价' }]}>
          <InputNumber min={0.01} precision={2} prefix="¥" placeholder="请输入采购单价" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} placeholder="可填写供应商、批次等补充信息" />
        </Form.Item>
        <Form.Item className="stock-operation-submit">
          <Button type="primary" htmlType="submit" loading={loading} block>确认入库</Button>
        </Form.Item>
      </Form>
      </Card>
    </div>
  );
}

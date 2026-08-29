import { useState, useEffect } from 'react';
import { Form, Select, InputNumber, Input, Button, message, Card, DatePicker } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getApiErrorMessage, tireApi, stockApi } from '../services/api';
import type { Tire } from '../services/api';
import './StockOperation.css';

interface StockOutFormValues {
  tireId: number;
  quantity: number;
  stockOutTime: Dayjs;
  recipient: string;
  unitPrice: number;
  remark?: string;
}

export default function StockOut() {
  const [tires, setTires] = useState<Tire[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    tireApi.list().then(res => setTires(res.data.data));
  }, []);

  const handleSubmit = async (values: StockOutFormValues) => {
    setLoading(true);
    try {
      await stockApi.stockOut({
        ...values,
        stockOutTime: values.stockOutTime.format('YYYY-MM-DD'),
      });
      message.success('出库成功');
      form.resetFields();
      form.setFieldValue('stockOutTime', dayjs());
      tireApi.list().then(res => setTires(res.data.data));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '出库失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stock-operation-page stock-operation-out">
      <Card
        className="stock-operation-card"
        title={(
          <div className="stock-operation-heading">
            <span className="stock-operation-icon"><ExportOutlined /></span>
            <span>
              <strong>轮胎出库</strong>
              <small>登记销售数量、收货人和成交单价</small>
            </span>
          </div>
        )}
      >
      <Form className="stock-operation-form" form={form} layout="vertical" size="large" onFinish={handleSubmit} initialValues={{ stockOutTime: dayjs() }}>
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
          <Form.Item name="quantity" label="出库数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} placeholder="请输入出库数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stockOutTime" label="出库日期" rules={[{ required: true, message: '请选择出库日期' }]}>
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="unitPrice" label="卖出单价" rules={[{ required: true, message: '请输入卖出单价' }]}>
          <InputNumber min={0.01} precision={2} prefix="¥" placeholder="请输入成交单价" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="recipient" label="收货人" rules={[{ required: true, message: '请输入收货人' }]}>
          <Input placeholder="请输入个人姓名或单位名称" />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} placeholder="可填写订单号、配送方式等补充信息" />
        </Form.Item>
        <Form.Item className="stock-operation-submit">
          <Button type="primary" danger htmlType="submit" loading={loading} block>确认出库</Button>
        </Form.Item>
      </Form>
      </Card>
    </div>
  );
}

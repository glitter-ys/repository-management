import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, ConfigProvider } from 'antd';
import zhCNraw from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined,
  UnorderedListOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import TireList from './pages/TireList';
import StockIn from './pages/StockIn';
import StockOut from './pages/StockOut';
import StockRecords from './pages/StockRecords';
import InventoryCheck from './pages/InventoryCheck';
import './App.css';

// 让 dayjs 与 antd 组件（日期选择器等）统一显示为中文。
dayjs.locale('zh-cn');

// Vite 8/rolldown 打包该 CJS 语言包时会保留 { default: {...} } 外壳，
// 需手动解包，否则 ConfigProvider 拿不到 DatePicker/Empty 等语言项而回退英文。
const zhCN = ((zhCNraw as unknown as { default?: typeof zhCNraw }).default ?? zhCNraw);

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">数据总览</Link> },
  { key: '/tires', icon: <DatabaseOutlined />, label: <Link to="/tires">轮胎管理</Link> },
  { key: '/stock-in', icon: <ImportOutlined />, label: <Link to="/stock-in">入库操作</Link> },
  { key: '/stock-out', icon: <ExportOutlined />, label: <Link to="/stock-out">出库操作</Link> },
  { key: '/records', icon: <UnorderedListOutlined />, label: <Link to="/records">出入库记录</Link> },
  { key: '/inventory-check', icon: <AuditOutlined />, label: <Link to="/inventory-check">库存盘点</Link> },
];

function AppLayout() {
  const location = useLocation();
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
          轮胎仓库管理
        </div>
        <Menu className="app-menu" theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', fontSize: 22, fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>
          {menuItems.find(m => m.key === location.pathname)?.label || '轮胎仓库管理系统'}
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tires" element={<TireList />} />
            <Route path="/stock-in" element={<StockIn />} />
            <Route path="/stock-out" element={<StockOut />} />
            <Route path="/records" element={<StockRecords />} />
            <Route path="/inventory-check" element={<InventoryCheck />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ConfigProvider>
  );
}

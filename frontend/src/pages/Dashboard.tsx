import { useEffect, useState, type ReactNode } from 'react';
import { Card, Col, Empty, Row, Skeleton, Statistic } from 'antd';
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  PieChartOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { stockApi } from '../services/api';
import type { Stats } from '../services/api';
import './Dashboard.css';

const PIE_COLORS = ['#147d70', '#2e9f8b', '#57bda6', '#8bd4bd', '#f0b45f', '#e0894a', '#c9718f', '#6d84b4'];

const PIE_CX = 280;
const PIE_CY = 150;
const PIE_OUTER = 120;
const PIE_INNER = 76;
const LABEL_X = 150;
const LABEL_LINE = 15;
const LABEL_MAX_CHARS = 8;
const LABEL_MAX_LINES = 2;

// Wrap a space-separated label onto up to LABEL_MAX_LINES lines for SVG rendering.
const wrapLabel = (label: string) => {
  const tokens = label.split(' ').filter(Boolean);
  const lines: string[] = [];
  tokens.forEach(token => {
    const last = lines[lines.length - 1];
    if (last === undefined) {
      lines.push(token);
    } else if (lines.length >= LABEL_MAX_LINES || (`${last} ${token}`).length <= LABEL_MAX_CHARS) {
      lines[lines.length - 1] = `${last} ${token}`;
    } else {
      lines.push(token);
    }
  });
  return lines.length ? lines : [label];
};

const getProductSlices = (products: Stats['productStats']) => {
  const sorted = [...products].sort((a, b) => b.total - a.total);
  const primary = sorted.slice(0, 7).map(item => ({
    key: String(item.id),
    label: `${item.brand} ${item.model} ${item.size}`,
    total: item.total,
  }));
  const otherTotal = sorted.slice(7).reduce((sum, item) => sum + item.total, 0);
  if (otherTotal > 0) {
    primary.push({ key: 'other', label: '其他商品', total: otherTotal });
  }
  return primary.map((item, index) => ({ ...item, color: PIE_COLORS[index] }));
};

const getPiePoint = (angle: number, radius: number) => {
  const radians = angle * Math.PI / 180;
  return {
    x: PIE_CX + radius * Math.cos(radians),
    y: PIE_CY + radius * Math.sin(radians),
  };
};

const getProductSegments = (slices: ReturnType<typeof getProductSlices>, total: number) => {
  const base = slices.map((item, index) => {
    const previousTotal = slices.slice(0, index).reduce((sum, slice) => sum + slice.total, 0);
    const startAngle = previousTotal / total * 360 - 90;
    const rawEndAngle = (previousTotal + item.total) / total * 360 - 90;
    const endAngle = rawEndAngle - startAngle >= 360 ? rawEndAngle - 0.001 : rawEndAngle;
    const outerStart = getPiePoint(startAngle, PIE_OUTER);
    const outerEnd = getPiePoint(endAngle, PIE_OUTER);
    const innerStart = getPiePoint(startAngle, PIE_INNER);
    const innerEnd = getPiePoint(endAngle, PIE_INNER);
    const middleAngle = (startAngle + rawEndAngle) / 2;
    const edge = getPiePoint(middleAngle, PIE_OUTER);
    const stub = getPiePoint(middleAngle, PIE_OUTER + 14);
    const side = Math.cos(middleAngle * Math.PI / 180) >= 0 ? 1 : -1;
    const percentage = item.total / total * 100;
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const lines = wrapLabel(item.label);

    return {
      ...item,
      percentage,
      side,
      edge,
      stub,
      labelY: stub.y,
      lines,
      // Total label height = name lines + one meta line.
      height: (lines.length + 1) * LABEL_LINE,
      path: [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${PIE_OUTER} ${PIE_OUTER} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${PIE_INNER} ${PIE_INNER} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
        'Z',
      ].join(' '),
    };
  });

  // Spread callout labels on each side so multi-line labels never overlap vertically.
  [1, -1].forEach(side => {
    const group = base.filter(s => s.side === side).sort((a, b) => a.labelY - b.labelY);
    for (let i = 1; i < group.length; i += 1) {
      const minGap = (group[i - 1].height + group[i].height) / 2 + 4;
      if (group[i].labelY - group[i - 1].labelY < minGap) {
        group[i].labelY = group[i - 1].labelY + minGap;
      }
    }
    const last = group[group.length - 1];
    if (last) {
      const bottomLimit = 300 - last.height / 2 - 6;
      if (last.labelY > bottomLimit) {
        const overflow = last.labelY - bottomLimit;
        group.forEach(s => { s.labelY -= overflow; });
      }
    }
    const first = group[0];
    if (first) {
      const topLimit = first.height / 2 + 6;
      if (first.labelY < topLimit) {
        const shift = topLimit - first.labelY;
        group.forEach(s => { s.labelY += shift; });
      }
    }
  });

  return base.map(s => {
    const anchorX = PIE_CX + s.side * LABEL_X;
    return {
      ...s,
      textX: anchorX + s.side * 8,
      textAnchor: s.side === 1 ? 'start' as const : 'end' as const,
      // Vertical offset of the first line so the whole block is centered on labelY.
      firstDy: -(s.lines.length * LABEL_LINE) / 2,
      leaderPath: `M ${s.edge.x} ${s.edge.y} L ${s.stub.x} ${s.stub.y} L ${anchorX} ${s.labelY}`,
    };
  });
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeProductKey, setActiveProductKey] = useState<string | null>(null);

  useEffect(() => {
    stockApi.stats().then(res => setStats(res.data.data));
  }, []);

  if (!stats) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  const brandMax = Math.max(1, ...stats.brandStats.map(item => item.total));
  const productSlices = getProductSlices(stats.productStats);
  const productTotal = productSlices.reduce((sum, item) => sum + item.total, 0);
  const productSegments = getProductSegments(productSlices, productTotal);
  const activeProduct = productSegments.find(item => item.key === activeProductKey);

  const overviewCards: {
    title: string;
    value: number;
    icon: ReactNode;
    tone: string;
    prefix?: string;
    precision?: number;
  }[] = [
    { title: '轮胎种类', value: stats.totalProducts, icon: <AppstoreOutlined />, tone: 'slate' },
    { title: '库存总量', value: stats.totalQuantity, icon: <DatabaseOutlined />, tone: 'blue' },
    { title: '库存金额', value: stats.totalAmount, icon: <WalletOutlined />, tone: 'gold', prefix: '¥', precision: 2 },
  ];

  const monthlyCards: {
    title: string;
    value: number;
    icon: ReactNode;
    tone: string;
    prefix?: string;
    precision?: number;
  }[] = [
    { title: '本月入库', value: stats.monthlyIn, icon: <CalendarOutlined />, tone: 'teal' },
    { title: '本月出库', value: stats.monthlyOut, icon: <CalendarOutlined />, tone: 'red' },
    { title: '本月入库金额', value: stats.monthlyInAmount, icon: <ArrowUpOutlined />, tone: 'teal', prefix: '¥', precision: 2 },
    { title: '本月出库金额', value: stats.monthlyOutAmount, icon: <ArrowDownOutlined />, tone: 'gold', prefix: '¥', precision: 2 },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-company">杭州优轮贸易有限公司</span>
          <h1>库存数据看板</h1>
        </div>
        <div className="dashboard-header-mark"><PieChartOutlined /></div>
      </header>

      <Row gutter={[16, 16]} className="dashboard-metrics">
        {overviewCards.map(card => (
          <Col xs={24} sm={8} key={card.title}>
            <Card className={`dashboard-metric dashboard-metric-${card.tone}`}>
              <span className="dashboard-metric-icon">{card.icon}</span>
              <Statistic title={card.title} value={card.value} prefix={card.prefix} precision={card.precision} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="dashboard-metrics">
        {monthlyCards.map(card => (
          <Col xs={12} lg={6} key={card.title}>
            <Card className={`dashboard-metric dashboard-metric-${card.tone}`}>
              <span className="dashboard-metric-icon">{card.icon}</span>
              <Statistic title={card.title} value={card.value} prefix={card.prefix} precision={card.precision} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[18, 18]} className="dashboard-charts">
        <Col xs={24}>
          <Card className="dashboard-chart-card" title="商品库存占比" extra={productTotal ? `${productSlices.length} 类商品` : undefined}>
            {productTotal ? (
              <div className="product-pie-layout">
                <div className="product-pie-shell">
                  <svg className="product-pie-svg" viewBox="0 0 560 300" role="img" aria-label="各商品库存占比饼状图">
                    {productSegments.map(item => (
                      <g
                        className={`product-pie-segment${activeProductKey === item.key ? ' is-active' : ''}`}
                        key={item.key}
                        onMouseEnter={() => setActiveProductKey(item.key)}
                        onMouseLeave={() => setActiveProductKey(null)}
                        onFocus={() => setActiveProductKey(item.key)}
                        onBlur={() => setActiveProductKey(null)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${item.label}，库存 ${item.total}，占比 ${item.percentage.toFixed(1)}%`}
                      >
                        <path className="product-pie-slice" d={item.path} fill={item.color} />
                        <path className="product-pie-leader" d={item.leaderPath} stroke={item.color} fill="none" />
                        <text className="product-pie-label" x={item.textX} y={item.labelY} textAnchor={item.textAnchor}>
                          {item.lines.map((line, index) => (
                            <tspan
                              className="pie-label-name"
                              key={line + index}
                              x={item.textX}
                              dy={index === 0 ? item.firstDy : LABEL_LINE}
                            >
                              {line}
                            </tspan>
                          ))}
                          <tspan className="pie-label-meta" x={item.textX} dy={LABEL_LINE}>{item.total} · {item.percentage.toFixed(1)}%</tspan>
                        </text>
                      </g>
                    ))}
                  </svg>
                  <div className={`product-pie-summary${activeProduct ? ' is-active' : ''}`}>
                    <span>{activeProduct?.label || '全部商品'}</span>
                    <strong>{activeProduct?.total ?? productTotal}</strong>
                    <em>{activeProduct ? `库存 · ${activeProduct.percentage.toFixed(1)}%` : '库存总量'}</em>
                  </div>
                </div>
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无库存数据" />}
          </Card>
        </Col>

        <Col xs={24}>
          <Card className="dashboard-chart-card" title="品牌库存分布">
            {stats.brandStats.length ? (
              <div className="brand-chart">
                {stats.brandStats.map((item, index) => (
                  <div className="brand-row" key={item.brand}>
                    <div className="brand-label">
                      <span><i>{String(index + 1).padStart(2, '0')}</i>{item.brand}</span>
                      <strong>{item.total}</strong>
                    </div>
                    <div className="brand-track">
                      <i style={{ width: `${item.total / brandMax * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无库存数据" />}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

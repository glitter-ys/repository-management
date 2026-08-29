# 轮胎仓库管理系统 - 实现计划

## Context

这是一个全新的轮胎仓库管理系统，目标用户是仓库管理员，采用前后端分离架构，实现基础库存管理功能（入库、出库、盘点、查询）。

---

## 推荐技术栈

**后端**：Node.js + Express + TypeScript + SQLite  
**前端**：React + TypeScript + Ant Design  
**理由**：
- Node.js/Express 轻量快速，适合中小型项目
- SQLite 无需额外数据库服务，开箱即用
- React + Ant Design 提供丰富的UI组件，开发效率高
- TypeScript 提供类型安全，减少后期维护成本

---

## 系统架构

```
repo/
├── backend/          # 后端服务
│   ├── src/
│   │   ├── models/   # 数据模型
│   │   ├── routes/   # API路由
│   │   ├── controllers/ # 业务逻辑
│   │   └── index.ts  # 入口文件
│   └── package.json
├── frontend/         # 前端应用
│   ├── src/
│   │   ├── pages/    # 页面组件
│   │   ├── services/ # API调用
│   │   └── App.tsx
│   └── package.json
└── README.md
```

---

## 核心数据模型

### 1. Tire（轮胎）
```
- id: number (主键)
- sku: string (唯一编码)
- brand: string (品牌)
- model: string (型号)
- size: string (规格，如: 225/55R17)
- quantity: number (库存数量)
- location: string (库位)
- createdAt: Date
- updatedAt: Date
```

### 2. StockRecord（出入库记录）
```
- id: number (主键)
- tireId: number (关联轮胎)
- type: 'IN' | 'OUT' (入库/出库)
- quantity: number (数量)
- operator: string (操作人)
- remark: string (备注)
- createdAt: Date
```

### 3. InventoryCheck（盘点记录）
```
- id: number (主键)
- checkDate: Date (盘点日期)
- items: JSON (盘点明细)
- operator: string (操作人)
- createdAt: Date
```

---

## 实现步骤

### Phase 1: 项目初始化
1. 创建后端项目结构，初始化 package.json，安装依赖
2. 创建前端项目（使用 Vite + React + TypeScript）
3. 配置 TypeScript、ESLint 等基础工具

### Phase 2: 后端开发
1. 配置 SQLite 数据库连接
2. 定义数据模型（Tire, StockRecord, InventoryCheck）
3. 实现轮胎CRUD API
4. 实现入库/出库 API
5. 实现库存盘点 API
6. 实现查询和统计 API

### Phase 3: 前端开发
1. 搭建基础布局（侧边栏、顶部导航）
2. 轮胎管理页面（列表、新增、编辑、删除）
3. 入库操作页面
4. 出库操作页面
5. 库存盘点页面
6. 库存查询与统计页面

### Phase 4: 集成与测试
1. 前后端联调
2. 功能测试
3. 编写 README 文档

---

## 关键文件清单

| 文件路径 | 描述 |
|---------|------|
| `backend/src/index.ts` | 后端入口，Express 服务启动 |
| `backend/src/models/index.ts` | 数据库模型定义 |
| `backend/src/routes/tires.ts` | 轮胎API路由 |
| `backend/src/routes/stock.ts` | 出入库API路由 |
| `frontend/src/App.tsx` | 前端主应用 |
| `frontend/src/pages/TireList.tsx` | 轮胎列表页 |
| `frontend/src/pages/StockIn.tsx` | 入库页面 |
| `frontend/src/pages/StockOut.tsx` | 出库页面 |

---

## 验证方式

1. 启动后端服务：`cd backend && npm run dev`
2. 启动前端服务：`cd frontend && npm run dev`
3. 在浏览器访问 http://localhost:5173
4. 测试流程：
   - 添加轮胎信息
   - 执行入库操作
   - 执行出库操作
   - 查看库存变化
   - 进行库存盘点


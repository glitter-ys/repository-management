# 轮胎仓库管理系统

一个基于前后端分离架构的轮胎仓库管理系统，提供库存管理、出入库操作、库存盘点和数据统计功能。

## 技术栈

- **后端**：Node.js + Express + TypeScript + SQLite (sql.js)
- **前端**：React + TypeScript + Ant Design + Vite

## 功能模块

| 模块 | 说明 |
|------|------|
| 数据总览 | 商品种类、库存总量、库存金额（按进价 FIFO 估算，反映可开票金额）、本月出入库数量及金额、商品库存占比、品牌库存分布 |
| 轮胎管理 | 轮胎信息的增删改查，支持按品牌/型号/规格搜索，并可查看单个商品的出入库记录 |
| 入库操作 | 选择轮胎并录入入库数量、入库时间、商品单价和备注 |
| 出库操作 | 选择轮胎并录入出库数量、出库日期、收货人、卖出单价和备注，库存不足时自动拦截 |
| 出入库记录 | 查看出入库及盘点记录，支持多条件筛选，展示单价/总价并统计筛选后入库/出库总金额；盘点记录可编辑与撤销 |
| 库存盘点 | 对比系统数量与实际数量，提交后自动更新库存 |

## 快速开始

### 环境要求

- Node.js >= 18

### 安装依赖

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 启动服务

分别在两个终端中运行：

```bash
# 终端 1 - 启动后端 (http://localhost:3000)
cd backend
npm run dev

# 终端 2 - 启动前端 (http://localhost:5173)
cd frontend
npm run dev
```

浏览器访问 http://localhost:5173 即可使用。

## 打包为单个 exe（在其他电脑上运行）

本项目可打包成 **单个 Windows 可执行文件**（`release/tire-warehouse.exe`），拷到任意
Windows 电脑双击即可运行，无需安装 Node.js、数据库或任何依赖。

打包基于 Node.js 内置的 **单可执行应用（SEA）** 能力，复用本机已装的 Node 运行时，
只需从 npm 安装 `esbuild` 与 `postject`，**不依赖 GitHub 下载**，因此在无法访问
github.com 的网络环境下也能顺利打包。

### 打包步骤

在项目根目录执行（打包机需已安装 Node.js >= 20，且 backend/frontend 已 `npm install`）：

```bash
# 1. 安装各部分依赖（仅首次）
npm install                       # 根目录：打包工具 esbuild + postject
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 2. 一键打包
npm run build:exe
```

完成后会生成 `release/tire-warehouse.exe`（约 100 MB，内含 Node 运行时 + 前端页面 +
后端服务 + 数据库引擎）。

### 运行方式

1. 把 `tire-warehouse.exe` 拷到目标电脑任意目录，**双击运行**；
2. 会弹出一个命令行窗口并自动打开浏览器访问 `http://localhost:3000`；
3. **保持该命令行窗口开启**，关闭窗口即退出程序；
4. 数据自动保存在 exe 同目录下的 `data.db` 文件中，升级换机时连同 `data.db` 一起
   拷贝即可保留全部数据。

> 端口默认 3000，如被占用可设置环境变量 `TIRE_WAREHOUSE_PORT` 更改；
> 数据库位置可用 `TIRE_WAREHOUSE_DB_PATH` 指定。

## 项目结构

```
repo/
├── backend/
│   ├── src/
│   │   ├── models/index.ts    # 数据库初始化与操作
│   │   ├── routes/tires.ts    # 轮胎 CRUD API
│   │   ├── routes/stock.ts    # 出入库、盘点、统计 API
│   │   └── index.ts           # Express 服务入口
│   └── data.db                # SQLite 数据库文件（运行后自动生成）
├── frontend/
│   ├── src/
│   │   ├── services/api.ts    # API 请求封装
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # 数据总览
│   │   │   ├── TireList.tsx       # 轮胎管理
│   │   │   ├── StockIn.tsx        # 入库操作
│   │   │   ├── StockOut.tsx       # 出库操作
│   │   │   ├── StockRecords.tsx   # 出入库记录
│   │   │   └── InventoryCheck.tsx # 库存盘点
│   │   ├── App.tsx            # 路由与布局
│   │   └── main.tsx           # 入口文件
│   └── package.json
└── plan.md
```

## API 接口

### 轮胎管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tires` | 查询轮胎列表，支持 `keyword`/`brand`/`model`/`size` 参数 |
| GET | `/api/tires/:id` | 查询单个轮胎 |
| POST | `/api/tires` | 新增轮胎 |
| PUT | `/api/tires/:id` | 编辑轮胎 |
| DELETE | `/api/tires/:id` | 删除轮胎 |

### 出入库与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/stock/in` | 入库 |
| POST | `/api/stock/out` | 出库 |
| GET | `/api/stock/records` | 出入库记录，支持 `tireId`/`type` 筛选 |
| POST | `/api/stock/inventory-check` | 提交盘点 |
| GET | `/api/stock/inventory-checks` | 盘点历史 |
| PUT | `/api/stock/inventory-check/:checkId/item/:tireId` | 编辑某条盘点项的实际数量 |
| DELETE | `/api/stock/inventory-check/:checkId/item/:tireId` | 撤销某条盘点项（回滚库存调整） |
| GET | `/api/stock/stats` | 统计数据（含 FIFO 库存金额、本月出入库金额） |

## 环境要求（打包机）

- 运行开发环境：Node.js >= 18
- 打包为 exe：Node.js >= 20（SEA 需要）

## 数据存储

数据保存在 `backend/data.db`（SQLite 文件），运行后自动生成，无需额外安装数据库服务。

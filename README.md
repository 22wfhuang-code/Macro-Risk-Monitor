Macro Risk Monitor
项目定位

Macro Risk Monitor 是一个基于 Python 的 Daily Static Data Pipeline 系统。

该项目模拟真实数据产品的构建流程，将：

数据生成 → 因子建模 → 风险评分 → Regime 分类 → JSON 结构化输出 → Snapshot 归档

完整封装为一个 可复现、可追溯、可扩展的工程系统。

本项目核心不是“预测市场”，而是：

设计一个工程化的数据自动构建流程。

核心能力体现

构建每日可重复执行的数据 pipeline

设计 0–100 多因子加权评分模型

实现 Tail Risk 惩罚机制（凸函数惩罚）

实现 EMA 趋势平滑

输出标准化 JSON 数据 contract

支持多 topic 模块（macro / ashares / copper）

生成 HTML Snapshot 自动归档

保证 deterministic build（同一天同输入输出一致）

工程架构设计

核心入口：

python main.py

运行后自动生成：

site/data/latest.json
site/data/daily/YYYY-MM-DD.json
site/data/history_stats.json
site/archive/YYYY-MM-DD.html

数据与展示完全解耦。

系统具备：

模块化权重设计

因子贡献拆解

Reproducibility 证明机制（proof_hash）

历史版本自动维护

风险模型结构

多因子加权求和

权重标准化

极端因子尾部风险惩罚

EMA 平滑趋势计算

Regime 分类逻辑

评分区间：0–100
输出字段结构稳定，可直接作为 API 输出。

关于数据说明

当前版本使用 deterministic mock 数据。

目的：

固定数据结构

验证 pipeline 架构

预留真实数据源替换接口

真实数据接入只需替换数据生成模块，不影响输出结构。

可扩展方向

接入真实行情 API

接入宏观数据库

引入数据库持久化

增加 REST API 层

接入前端动态展示框架

技术栈

Python
JSON
Static Build
HTML / CSS / JS
GitHub Pages 部署

项目价值

该项目展示：

数据工程思维

模块解耦设计

自动构建流程

可复现性保障

数据产物规范设计

适合作为数据自动化 / AI 应用工程方向的实践案例。

在线 Demo

（填写链接）

作者：黄伟峰
数学与应用数学
Python 数据自动化方向
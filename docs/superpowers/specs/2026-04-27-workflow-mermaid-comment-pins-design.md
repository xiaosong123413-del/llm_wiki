# Workflow Mermaid 图钉评论设计

## 目标

把 Workflow 详情页 `#/automation/<id>` 的 Mermaid 流程图升级成一个可评论、可拖动、可持久保存的图钉评论面。

用户需要能够：

- 点击某个 Mermaid 节点、连线或图上的空白位置创建评论
- 在图上看到一个小评论图钉附着在对应位置
- 后续重开页面时继续看到这些图钉
- 当原图形消失或 Mermaid 重新布局后，评论不自动丢失
- 手动拖动图钉到新的对应位置

## 范围

本轮只覆盖 Workflow 详情页的 Mermaid 图评论，不做全站通用评论系统。

包含：

- `#/automation/<id>` Mermaid 图上的评论模式
- 图钉创建、显示、拖动、删除
- 图形变化后的评论保留与重挂接
- 评论列表
- 前后端测试

不包含：

- wiki 页面评论系统改造
- 项目日志评论系统改造
- 评论回复、提及、多人协作
- 自动把拖动后的图钉重新绑定成新的节点锚点
- 图上任意自由绘制、框选批注、截图批注

## 已确认现状

当前代码里已经有一半基础设施：

- Workflow detail API 已返回 `comments`
- 后端已有 `create / delete` 评论路由
- 运行时已有 `automation-comments.json` 存储
- 旧的 flow-layout 里已有节点/边评论锚点重算测试
- 旧的评论面板模板也还在

但当前 Mermaid 详情页已经改成“手写 Mermaid 直通渲染”，没有再把这些评论能力接到图层上，所以评论能力实际上处于闲置状态。

## 方案对比

### 方案 A：恢复旧 DAG 画布，再把评论挂回旧画布

优点：

- 旧评论锚点、旧布局代码可直接复用更多

缺点：

- 和当前已经确认通过的“原生 Mermaid 原图直通”路线冲突
- 会把图的颜色、布局、边标签能力重新带偏
- 为了评论功能回退整张图的实现，代价过高

结论：

- 不采用

### 方案 B：在 Mermaid SVG 上方增加独立图钉层，并把评论独立持久化

优点：

- 不破坏当前 Mermaid 原图能力
- 图钉是独立层，Mermaid 重渲染后仍可重新定位
- 改动集中在 Workflow detail 页面和评论存储
- 能精确满足“图形消失不删、显式删除才删、可拖动重放”的需求

缺点：

- 需要新增 SVG 坐标和屏幕坐标之间的换算
- 需要扩展现有评论数据结构

结论：

- 采用

### 方案 C：把 Mermaid 源码解析成可编辑语义图，再让评论绑定语义节点

优点：

- 长期最强，可做更多高级编辑能力

缺点：

- 明显过度设计
- 与当前需求不成比例

结论：

- 不采用

## 最终设计

### 1. 交互模型

Workflow 详情页新增一个显式“评论模式”。

进入评论模式后：

1. 用户点击某个节点
2. 或点击某条边的可点击区域
3. 或点击图上的空白位置
4. 页面立即生成一个小评论图钉
5. 右侧评论面板聚焦到这条评论输入框
6. 用户输入评论并保存

评论保存后：

- 图钉继续留在图上
- 右侧评论列表中出现对应卡片
- 同一条评论在图钉和列表中互相高亮

用户可以：

- 点击图钉选中评论
- 在右侧编辑文字
- 拖动图钉到新位置
- 删除评论

### 2. 图钉定位规则

评论必须独立于当前 Mermaid DOM 存在，不能把存活性绑定到某一轮 SVG 节点实例上。

每条评论同时保存两类信息：

1. 逻辑锚点
- 原始目标类型：`node | edge | canvas`
- 原始目标 id：节点 id / 边 id / 空白区域标记

2. 视觉位置
- Mermaid 图内部坐标系下的 `x / y`
- 用户手动拖动后的 `manualX / manualY`

定位优先级：

1. 如果评论未手动拖动，且目标节点/边仍存在，则按最新目标位置重新计算图钉位置
2. 如果目标不存在，则保留最后一次可用的图内坐标
3. 如果用户手动拖动过，则优先使用手动位置

这意味着：

- 节点移动时，评论可跟随
- 节点消失时，评论不会消失
- 用户拖动后，评论固定在用户指定的位置

### 3. 删除规则

评论只允许显式删除。

以下情况都不能自动删除评论：

- Mermaid 图重新渲染
- 节点改名
- 节点消失
- 手写 Mermaid 分支结构变化

只有用户点击删除，评论才从存储中移除。

### 4. 图形变化后的状态

当原目标节点或边不存在时，评论进入“失联但保留”状态。

表现方式：

- 图钉继续显示在最后已知位置
- 右侧评论卡片显示“原目标已不存在”
- 用户仍可编辑文本
- 用户仍可拖动图钉

本轮不做“拖到新节点上后自动重新认领 nodeId”。

原因：

- 用户只明确要求“可以移动图标到对应位置”
- 没有明确要求必须自动改写逻辑锚点
- 自动认领会引入额外歧义和错误绑定风险

## 数据结构

现有 `AutomationWorkspaceComment` 需要扩展为：

```ts
interface AutomationWorkspaceComment {
  id: string;
  automationId: string;
  targetType: "node" | "edge" | "canvas";
  targetId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  pinnedX: number;
  pinnedY: number;
  manualX?: number;
  manualY?: number;
}
```

说明：

- `pinnedX / pinnedY`：最后一次有效的 Mermaid 图内坐标
- `manualX / manualY`：用户拖动后的位置；未拖动时为空
- `targetType = "canvas"`：允许直接评论图上的空白区域

本轮不新增 `resolved / submitted / thread / author` 等额外状态，避免过度设计。

## 前端实现边界

### 1. Mermaid 详情层

在 Mermaid SVG 外层增加一个绝对定位的图钉覆盖层：

- Mermaid SVG 继续负责图本身
- 覆盖层负责评论图钉
- 两者共享同一个滚动容器

需要的新能力：

- 读取 SVG 实际尺寸
- 将节点/边位置映射到屏幕坐标
- 将用户点击位置反算回 Mermaid 图内坐标
- 支持拖动图钉并持久保存

### 2. 右侧评论面板

恢复并改造现有 automation comment panel：

- 顶部显示评论模式开关
- 中部显示评论列表
- 新建评论时聚焦输入框
- 删除后同步移除图钉

### 3. 详情页结构

Workflow 详情页从“只有图”改成“两栏结构”：

- 左侧：Mermaid 图 + 图钉层
- 右侧：评论面板

在窄宽度下，评论面板可下沉到图下方，但本轮优先保证桌面端。

## 后端实现边界

### 1. 评论存储

扩展 `.llmwiki/automation-comments.json` 的评论结构，支持：

- `canvas` 类型
- `updatedAt`
- `pinnedX / pinnedY`
- `manualX / manualY`

新增更新接口，而不是只保留 create/delete：

- `PATCH /api/automation-workspace/:id/comments/:commentId`

允许更新：

- `text`
- `manualX`
- `manualY`
- `pinnedX`
- `pinnedY`
- `targetType`
- `targetId`

## 文件边界

预期主要修改：

- `web/client/src/pages/automation/index.ts`
- `web/client/src/pages/automation/api.ts`
- `web/client/src/pages/automation/mermaid-view.ts`
- `web/client/src/pages/automation/panels.ts`
- `web/client/styles.css`
- `web/server/routes/automation-workspace.ts`
- `web/server/services/automation-workspace.ts`
- `web/server/services/automation-workspace-store.ts`
- `test/web-automation-detail-page.test.ts`
- `test/automation-workspace-routes.test.ts`
- 新增针对评论拖动与持久化行为的测试

不需要改：

- 手写 Mermaid source files
- code-derived flow schema
- Workflow 列表页
- 现有 wiki comments 系统

## 测试设计

至少覆盖：

1. Mermaid detail 页进入评论模式后，点击节点能创建图钉评论草稿
2. 点击空白区域也能创建 `canvas` 评论
3. 保存后图钉和右侧评论列表同时出现
4. 删除评论后图钉消失
5. 重新打开页面后评论仍存在
6. 当目标节点不存在时，评论仍返回并显示
7. 拖动图钉后，新的坐标会持久化
8. 评论模式关闭再打开后，现有图钉和右侧评论列表仍能正确对应

测试不要求验证真实像素级动画，但必须验证：

- 评论不会因为图形缺失而被自动删掉
- 拖动后的坐标会被保存

## 验收标准

- Workflow Mermaid 图上可以直接出现评论图钉
- 图钉与右侧评论列表互相对应
- 图形变化后评论仍保留
- 只有显式删除才会移除评论
- 用户可以拖动图钉到新位置

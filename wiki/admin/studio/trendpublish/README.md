# Collection × TrendPublish 本地桥接

该目录把 Collection 的公众号审核界面接到 `liyown/ai-trend-publish`：

1. 网站点击“制作公众号版”。
2. Windows 通过 `trendpublish://launch` 启动本地桥接服务。
3. 本地服务使用 TrendPublish 的微信模板或动态 HTML 生成器返回公众号 HTML。
4. 用户在 Collection 中审核标题、摘要、封面和最终 HTML。
5. 点击“发送到公众号草稿箱”后，本地服务上传正文图片、上传封面并创建微信草稿。
6. 发送完成后，本地服务在数秒后退出；空闲 30 分钟也会退出。

## 安装

在 Windows PowerShell 中执行：

```powershell
irm https://llm-wiki.cn/admin/studio/trendpublish/install.ps1 | iex
```

安装过程会：

- 安装或检查 Deno；
- 克隆 `liyown/ai-trend-publish` 到 `%LOCALAPPDATA%\XiaosongTrendPublish`；
- 安装 Collection bridge；
- 注册 `trendpublish://` 协议；
- 询问 AI API 与微信公众号凭证；
- 生成本地配对密钥并复制到剪贴板。

## 安全边界

- `AI_API_KEY`、`WEIXIN_APP_ID`、`WEIXIN_APP_SECRET` 仅保存在本地。
- 本地桥接只监听 `127.0.0.1:8765`。
- 仅允许配置中的网站 Origin 访问。
- 所有写操作要求 `X-TrendPublish-Key`。
- 微信公众号仍会校验当前公网 IP 白名单。

## 当前输入边界

当前仅接入 `contentKind: article` 的纯文字或图文文章。桥接会优先读取：

- `bodyText`
- `articleText`
- `content`
- `markdown`
- `bodyHtml`

思维导图与 HTML 页面需要后续增加独立的 source adapter。

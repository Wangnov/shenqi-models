# Cloudflare 模型展厅

- 首页：<https://model.wangnov-ai.com/>
- 三神器：<https://model.wangnov-ai.com/shenqi/>
- 章节：`/shenqi/#eternity`、`/shenqi/#space`、`/shenqi/#time`

使用 Cloudflare Workers Static Assets，Worker 名为 `wangnov-model-gallery`，自定义域名为 `model.wangnov-ai.com`。模型、音乐、贴图及页面资源全部由该站提供。

## 更新部署

先安装 Wrangler 并登录正确的 Cloudflare 账户。不要把凭据写入配置或仓库。

```bash
cd web
npm ci
wrangler whoami
npm run deploy:cf
```

`deploy:cf` 先构建 Three.js 页面，再组装目录和所有预览项目，最后部署。配置在 `cloudflare/wrangler.jsonc`；可单独运行 `npm run build:cf` 构建，或在仓库根目录运行 `wrangler dev --config cloudflare/wrangler.jsonc` 本地验证。

本次 Cloudflare 发布使用已登录的本机 Wrangler。GitHub Pages 仍保留现有自动发布作为镜像；推送 GitHub 不会自动更新 Cloudflare，更新主站时必须执行上述部署命令。

## 增加其他模型预览

每个项目有独立目录：`/<slug>/`，资源必须使用相对路径或对应的路径前缀。不要让其他项目写入 `/shenqi/`。

1. 将新的预览页源码放到仓库独立目录，构建得到含 `index.html` 的静态目录。
2. 在 `catalog.json` 中新增条目，设置唯一 `slug`、名称、简介、构建目录 `source`，以及带预览图的 `scenes`。`source` 相对仓库根目录。
3. 为新项目加入构建命令，使所有条目的构建输出均已生成，再运行 `npm run deploy:cf`。

构建器会在清理生成目录前校验所有已登记项目的构建文件。每次部署包含完整目录，不要直接把某一个新项目单独上传到同一个 Worker，以免覆盖已上线的其他项目。所有线上项目都应登记在 `catalog.json`。

根路径为展厅目录；`/shenqi` 自动跳转到 `/shenqi/`；不存在的页面返回真正的 404，不回退成另一个模型的页面。

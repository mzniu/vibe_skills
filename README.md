# vibe_skills

可交给 Agent 安装的 Claude Code 技能。当前包含一个技能：用代码渲染竖屏知识短视频，而不是用扩散模型生成视频。

## vibe-knowledge-video

适合抖音、Bilibili、小红书的 3–60 秒竖屏讲解：1080×1920、30fps、3 秒钩子。Agent 按分镜写确定性的 HTML/Canvas，用无头浏览器逐帧渲染，再用 ffmpeg 编码，并做亮度与响度检查。

安装完成后，在新对话里发送：

```text
/vibe-knowledge-video
```

文件夹必须保持这个结构，不能把文件摊平：

```text
skills/vibe-knowledge-video/
  SKILL.md
  references/     pipeline.md、pitfalls.md、bgm.md
  scripts/        brightness-check.mjs、mix-bgm.mjs
  templates/      storyboard.json
```

本仓库不包含背景音乐。技能只说明如何混入用户自己提供、且已获授权的音轨。

## 让 Agent 安装

把下面整段原样发给 Agent。它会自己下载并放到正确目录。

````text
请安装 Claude Code 技能 vibe-knowledge-video，来源是 https://github.com/mzniu/vibe_skills 的 main 分支，目录 skills/vibe-knowledge-video。

请你自己完成，不要让我手动复制文件。

1. 下载整个 skills/vibe-knowledge-video 目录。保留 references、scripts、templates 里的全部文件。目录名保持 vibe-knowledge-video，不要改名，不要只复制 SKILL.md。
2. 安装到下面每一个已经存在、或按规则应该创建的技能目录。每一处都是一份完整副本：
   - 用户级 Claude 技能：~/.claude/skills/vibe-knowledge-video
     Windows 路径：%USERPROFILE%\.claude\skills\vibe-knowledge-video
   - 如果存在 %USERPROFILE%\NiuClaude（NiuClaude 桌面版），再安装一份到 %USERPROFILE%\NiuClaude\.claude\skills\vibe-knowledge-video。NiuClaude 读的是自己的数据目录，不会去读 Windows 用户主目录下的 .claude\skills。
   - 如果设置了环境变量 CLAUDE_CONFIG_DIR，并且 $CLAUDE_CONFIG_DIR/.claude/skills 与上面两处不同，也安装一份到那里。
3. 安装结束后，每一处都必须存在文件 vibe-knowledge-video/SKILL.md，且文件开头的 name 是 vibe-knowledge-video。
4. 不要下载或写入任何音乐文件。
5. 完成后告诉我每个安装路径。提醒我新开一轮对话后，用 /vibe-knowledge-video 调用。
````

已安装过的目录会被这整份文件覆盖。技能目录里如果另有你自己改过的副本，安装前先备份。

## 自己安装

Windows PowerShell：

```powershell
git clone https://github.com/mzniu/vibe_skills.git
$src = "vibe_skills\skills\vibe-knowledge-video"
$targets = @(
  (Join-Path $env:USERPROFILE ".claude\skills\vibe-knowledge-video")
)
$niu = Join-Path $env:USERPROFILE "NiuClaude"
if (Test-Path $niu) {
  $targets += (Join-Path $niu ".claude\skills\vibe-knowledge-video")
}
if ($env:CLAUDE_CONFIG_DIR) {
  $targets += (Join-Path $env:CLAUDE_CONFIG_DIR ".claude\skills\vibe-knowledge-video")
}
$targets = $targets | Select-Object -Unique
foreach ($dest in $targets) {
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  Copy-Item -Recurse $src $dest
  Write-Host "installed $dest"
}
```

macOS / Linux：

```bash
git clone https://github.com/mzniu/vibe_skills.git
src=vibe_skills/skills/vibe-knowledge-video
dest="${CLAUDE_CONFIG_DIR:-$HOME}/.claude/skills/vibe-knowledge-video"
mkdir -p "$(dirname "$dest")"
rm -rf "$dest"
cp -R "$src" "$dest"
```

只想在某一个项目里使用时，把同一目录复制到该项目的 `.claude/skills/vibe-knowledge-video`。

## 做视频时需要的工具

安装技能本身只是复制文件。真正渲染一条片子时，机器上还要有：

- Node.js
- 已加入 PATH 的 ffmpeg
- Puppeteer 能启动的 Chromium（在具体视频项目里安装，不在这个仓库里）
- 用户提供的已授权背景音乐。不要从网上下载热门曲目来代替

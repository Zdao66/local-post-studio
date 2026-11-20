# Source snapshot / 源码快照

This snapshot contains the application logic from the Windows development build. It is intended for source review and porting. The Windows launcher expects the packaged Electron executable, a bundled Python runtime and native codec tools. Those dependencies and the model weights are distributed separately. macOS and Linux builds are planned.

这份快照包含 Windows 开发版的应用逻辑，用于审阅和移植。现有 Windows 启动器依赖打包后的 Electron、本地 Python 运行时和原生编码工具。运行依赖与模型权重另行分发。macOS 和 Linux 构建仍在规划中。

- `界面/` — user interface / 用户界面
- `resources/app/` — Electron launcher and preload / Electron 启动器与预加载脚本
- Root Python files — local media service, transcription and export / 本地媒体服务、识别及导出

The Freeman tone-mapping implementation includes its upstream MIT notice in [tools/Freeman-DCTL-LICENSE.txt](tools/Freeman-DCTL-LICENSE.txt). That notice applies to the upstream contribution.

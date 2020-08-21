# 这是个玩具项目

# Node.js version of ls -alhF
- 输出风格和原生 BSD ls -alhF 一致
- 计算目录大小
- 易读的修改时间
- 符合直觉的创建时间
- 显示文件类型
- 文本文件字数统计

# Usage
``` shell
# 当前目录
$ node index.js

# 指定目录
$ node index.js ~/Downloads

# 按大小排序
$ node index.js ~/Downloads -s

# 按大小反向排序
$ node index.js ~/Downloads -sr

# 按修改时间排序
$ node index.js ~/Downloads -t

# 按修改时间反向排序
$ node index.js ~/Downloads -tr
```

# Notes
- 因为系统权限限制，部分目录的计算大小可能不准确，可以使用 sudo
- 仅支持 Mac OS
- 永远不会进行磁盘/文件系统/文件的写入和改动，请放心食用

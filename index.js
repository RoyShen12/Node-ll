const PNAME = 'node-ll'
process.title = PNAME

const os = require('os')

if (os.platform() !== 'darwin') {
  console.error('仅支持 Mac OS 系统 !')
  exit(1)
}

const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const { execSync } = require('child_process')

const chalk = require('chalk')
const { exit } = require('process')

const fmt = new Intl.NumberFormat('en-US')

const flags = process.argv.filter(a => a[0] === '-')

const arg = process.argv.filter(a => a[0] !== '-')[2]

if (arg) {
  if (!fs.existsSync(arg)) {
    console.error(`${PNAME}: "${arg}": 未找到此目录`)
  }
  else if (!fs.statSync(arg).isDirectory()) {
    console.error(`${PNAME}: "${arg}": 不是合法的目录`)
  }
  else {
    readDir(arg).then(r => format(r))
  }
}
else {
  readDir(process.cwd()).then(r => format(r))
}

async function readDir(pt) {
  const flist = ['.', '..', ...(await fsp.readdir(pt))]

  return await Promise.all(flist.map(async file => {
    const filePath = path.join(pt, file)

    let dirCanAccess = true

    try {
      await fsp.access(filePath, fs.constants.F_OK | fs.constants.R_OK | fs.constants.X_OK)
    } catch (e) {
      // console.log(`reading dir ${path.join(pt, file)} was denied`)
      dirCanAccess = false
    }

    let f_flags = ''
    const lstat = await fsp.lstat(filePath)
    // * stat 可能存在sbl链接损坏
    const stat = fs.existsSync(filePath) && await fsp.stat(filePath)

    const isDir = lstat.isDirectory()
    const isSbl = lstat.isSymbolicLink()
    const isBlk = lstat.isBlockDevice()
    const isChd = lstat.isCharacterDevice()

    if (isDir) f_flags += 'd'
    else if (isSbl) f_flags += 'l'
    else if (lstat.isFIFO()) f_flags += 'f'
    else if (isBlk) f_flags += 'b'
    else if (isChd) f_flags += 'c'
    else if (lstat.isSocket()) f_flags += 's'
    else if (lstat.isFile()) f_flags += '-'
    else f_flags += '?'

    f_flags += ' '

    const fmode = lstat.mode.toString(8)
    f_flags += numToPerm[fmode[fmode.length - 3]] + ' '
    f_flags += numToPerm[fmode[fmode.length - 2]] + ' '
    f_flags += numToPerm[fmode[fmode.length - 1]] + ' '
    const spp = specialNumtoPerm[fmode[fmode.length - 4]]
    f_flags += spp

    const isSpExe = spp[0] === 's'
    const isGsExe = spp[1] === 's'

    const isExe = f_flags.includes('x')

    const f_hard_count = lstat.nlink + ' '

    let f_owner = uidToUser(lstat.uid + '')
    let f_group = gidToGroup(lstat.gid + '') + ' '

    let f_raw_size = lstat.size
    let f_size = toReadableSize(f_raw_size)
    if (isDir && !isSbl && dirCanAccess && !(pt === '/' || file === '.' || file === '..')) {
      const dsRet = await getRecursiveSize(filePath, { sum: 0, denied: { dir: 0, file: 0 } })
      if (dsRet.denied.dir > 0 || dsRet.denied.file > 0) console.log(`${dsRet.denied.dir} dir(s) and ${dsRet.denied.file} file(s) refused to scan`)
      f_raw_size = dsRet.sum
      f_size = `${toReadableSize(f_raw_size)} *`
    }

    let f_type = ''
    if (!isDir && !isSbl) {
      const fileShellName = filePath.replace(/\s|\(|\)|\[|\]/g, '\\$&')
      const typeRaw = execSync('file ' + fileShellName).toString()
      // console.log(chalk.blueBright('file ' + filePath))
      f_type = chalk.gray(typeRaw.split(':')[1].trim()/*.split(',')[0]*/)
      if (f_type.includes('text')) f_type += ' ' + fmt.format(+execSync('wc -c ' + fileShellName).toString().split(' ').filter(v => v)[0]) + '字'
    }

    const f_time = lstat.atime.getFullYear() + '-' +
      ((lstat.atime.getMonth() + 1) + '').padStart(2, '0') + '-' +
      (lstat.atime.getDate() + '').padStart(2, '0') + ' ' +
      (lstat.atime.getHours() + '').padStart(2, '0') + ':' + (lstat.atime.getMinutes() + '').padStart(2, '0') + ':' + (lstat.atime.getSeconds() + '').padStart(2, '0')

    const f_ctime_h = ' ' + toReadableTime(Date.now() - lstat.birthtime) + ' '

    let fn = file
    if (isSbl) fn = chalk.italic(chalk.magentaBright(file + (isExe ? '*' : ''))) + ' -> ' + (stat ? path.relative(pt, await fsp.realpath(path.resolve(pt, file))) : chalk.gray('@broken'))
    else if (isDir) fn = chalk.bold(chalk.cyanBright(file))
    else if (isBlk) fn = chalk.blueBright(file)
    else if (isChd) fn = chalk.yellowBright(file)
    else if (isExe) fn = chalk.redBright(file)

    if (isSpExe) fn = chalk.bgRed(fn)
    else if (isGsExe) fn = chalk.bgBlueBright(fn)

    let f_tail = ''
    if (isDir) f_tail = '/'
    else if (!isSbl && isExe) f_tail = chalk.redBright('*')

    return {
      _sort_fn: file,
      _sort_t: lstat.atimeMs,
      _sort_s: f_raw_size,
      f_flags,
      f_hard_count,
      f_owner,
      f_group,
      f_size,
      f_time,
      f_ctime_h,
      fname: fn + f_tail,
      f_type,
    }
  }))
}

function format(llRet) {
  const cache = {}
  const max_count = idx => {
    if (!cache[idx]) cache[idx] = llRet.reduce((pv, cv) => cv[idx].length > pv ? cv[idx].length : pv, -1)
    return cache[idx]
  }

  console.log(
    llRet.sort((a, b) => {
      if (a._sort_fn === '.' || (a._sort_fn === '..' && b._sort_fn !== '.')) return -1
      if (b._sort_fn === '.' || (b._sort_fn === '..' && a._sort_fn !== '.')) return 1

      if (flags.includes('-t')) return b._sort_t - a._sort_t
      else if (flags.includes('-tr') || flags.includes('-rt')) return a._sort_t - b._sort_t
      else if (flags.includes('-s')) return a._sort_s - b._sort_s
      else if (flags.includes('-sr') || flags.includes('-rs')) return b._sort_s - a._sort_s
      else return a._sort_fn.localeCompare(b._sort_fn)
    }).map(fInfo => {
      ['f_flags', 'f_hard_count', 'f_owner', 'f_group', 'f_size', 'f_ctime_h'].forEach(i => fInfo[i] = fInfo[i].padEnd(max_count(i)))

      if (fInfo.f_owner.trim() !== os.userInfo().username) fInfo.f_owner = chalk.bold(fInfo.f_owner)
      if (fInfo.f_group.trim() !== 'staff') fInfo.f_group = chalk.bold(fInfo.f_group)
      fInfo.f_size = fInfo.f_size.replace('*', chalk.greenBright('*'))

      let ret = ''
      for (const k in fInfo) {
        if (k[0] !== '_') ret += (fInfo[k] + ' ')
      }
      return ret.trim()
    }).join('\n')
  )
}

/**
 * @param {{ sum: number, denied: { dir: number, file: number } }} res
 */
async function getRecursiveSize(dir, res) {
  // console.log(dir, res)
  try {
    await fsp.access(dir, fs.constants.F_OK | fs.constants.X_OK)
  } catch (error) {
    res.denied.dir++
    // console.log(`getRecursiveSize scandir ${dir} denied`)
    return
  }

  const fl = await fsp.readdir(dir)
  for (const f of fl) {
    try {
      await fsp.access(path.join(dir, f), fs.constants.F_OK | fs.constants.R_OK)
    } catch (error) {
      res.denied.file++
      // console.log(`getRecursiveSize lstat ${path.join(dir, f)} denied`)
      continue
    }
    const fstat = await fsp.lstat(path.join(dir, f))
    if (fstat.isDirectory() && !fstat.isSymbolicLink()) await getRecursiveSize(path.join(dir, f), res)
    else if (fstat.isFile()) res.sum += fstat.size
  }
  return res
}

const numToPerm = {
  0: '---',
  1: '--x',
  2: '-w-',
  3: '-wx',
  4: 'r--',
  5: 'r-x',
  6: 'rw-',
  7: 'rwx'
}

const specialNumtoPerm = {
  0: '',
  1: '--t',
  2: '-s-',
  3: '-st',
  4: 's--',
  5: 's-t',
  6: 'ss-',
  7: 'sst'
}

const uidCache = {}
const gidCache = {}

execSync('dscl . -list /Groups  PrimaryGroupID').toString().split('\n').filter(a => a.length > 0).forEach(v => {
  const l = v.split(' ').filter(s => s !== '')
  gidCache[l[1]] = l[0]
})

// console.log(gidCache)

execSync('dscl . -list /Users UniqueID').toString().split('\n').filter(a => a.length > 0).forEach(v => {
  const l = v.split(' ').filter(s => s !== '')
  uidCache[l[1]] = l[0]
})

// console.log(uidCache)

function uidToUser(uid) {
  if (!uidCache[uid]) uidCache[uid] = execSync('id -nu ' + uid).toString().trim() || uid
  return uidCache[uid]
}

// const nameArr = execSync('gid -G --name').toString().split(' ').map(g => g.trim())
// const idArr = execSync('gid -G').toString().split(' ').map(g => g.trim())
// idArr.forEach((id, i) => gidCache[id] = nameArr[i])

function gidToGroup(gid) {
  return gidCache[gid] || gid
}

function toReadableSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

function toReadableTime(ms) {
  let sig = ''
  if (ms < 0) {
    ms = -ms
    sig = '-'
  }

  if (ms < 1000) sig += ms + ' ms'
  else if (ms < 6e4) sig += (ms / 1000).toFixed(1) + ' 秒前'
  else if (ms < 36e5) sig += Math.round(ms / 6e4) + ' 分 ' + (ms % 6e4 / 1000).toFixed(0) + ' 秒前'
  else if (ms < 864e5) sig += Math.round(ms / 36e5) + ' 时 ' + (ms % 36e5 / 6e4).toFixed(0) + ' 分前'
  else if (ms < 31536e6) sig += Math.round(ms / 864e5) + ' 天 ' + (ms % 864e5 / 36e5).toFixed(0) + ' 时前'
  else sig += Math.round(ms / 31536e6) + ' 年 ' + (ms % 31536e6 / 864e5).toFixed(0) + ' 天前'

  return sig
}

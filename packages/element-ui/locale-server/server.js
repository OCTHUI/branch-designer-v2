/**
 * 国际化配置持久化服务
 * 提供语言包文件的读写 API
 */

// 支持从父级 node_modules 或当前目录加载
function tryRequire(moduleName) {
    try {
        return require(moduleName);
    } catch (e) {
        try {
            return require(require('path').join(__dirname, '../../node_modules', moduleName));
        } catch (e2) {
            return require(require('path').join(__dirname, '../../../node_modules', moduleName));
        }
    }
}

const express = tryRequire('express');
const fs = require('fs');
const path = require('path');
const cors = tryRequire('cors');

const app = express();
const PORT = 3080;

// 语言包文件路径
const LOCALE_FILE = path.join(__dirname, '../src/locale/custom-locale.json');

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/**
 * 读取语言包
 */
app.get('/api/locale', (req, res) => {
    try {
        if (!fs.existsSync(LOCALE_FILE)) {
            // 文件不存在时返回空结构
            return res.json({
                'zh-cn': {},
                'en': {}
            });
        }
        
        const content = fs.readFileSync(LOCALE_FILE, 'utf-8');
        const data = JSON.parse(content);
        res.json(data);
    } catch (error) {
        console.error('读取语言包失败:', error);
        res.status(500).json({ error: '读取语言包失败', message: error.message });
    }
});

/**
 * 保存语言包（全量覆盖）
 */
app.post('/api/locale', (req, res) => {
    try {
        const data = req.body;
        
        // 验证数据结构
        if (typeof data !== 'object') {
            return res.status(400).json({ error: '无效的数据格式' });
        }
        
        // 写入文件（格式化 JSON）
        fs.writeFileSync(LOCALE_FILE, JSON.stringify(data, null, 2), 'utf-8');
        
        console.log(`语言包已保存：${Object.keys(data).join(', ')}`);
        res.json({ success: true, message: '保存成功' });
    } catch (error) {
        console.error('保存语言包失败:', error);
        res.status(500).json({ error: '保存语言包失败', message: error.message });
    }
});

/**
 * 批量更新词条 (必须在单个词条更新之前定义，避免路由冲突)
 */
app.patch('/api/locale/:lang/batch', (req, res) => {
    try {
        const { lang } = req.params;
        const entries = req.body.entries; // [{key, value}, ...]
        
        let data = {};
        
        // 读取现有数据
        if (fs.existsSync(LOCALE_FILE)) {
            const content = fs.readFileSync(LOCALE_FILE, 'utf-8');
            data = JSON.parse(content);
        }
        
        // 确保语言对象存在
        if (!data[lang]) {
            data[lang] = {};
        }
        
        // 批量更新
        let count = 0;
        entries.forEach(({ key, value }) => {
            if (!data[lang][key]) {
                count++;
            }
            data[lang][key] = value;
        });
        
        // 写入文件
        fs.writeFileSync(LOCALE_FILE, JSON.stringify(data, null, 2), 'utf-8');
        
        const result = { success: true, count: count, message: '导入 ' + count + ' 个新词条' };
        console.log('批量导入:', lang, '语言', count, '个新词条');
        console.log('返回:', JSON.stringify(result));
        res.status(200).json(result);
    } catch (error) {
        console.error('批量更新失败:', error);
        res.status(500).json({ error: '批量更新失败', message: error.message });
    }
});

/**
 * 更新单个词条 (在批量路由之后定义)
 */
app.patch('/api/locale/:lang/:key', (req, res) => {
    try {
        const { lang, key } = req.params;
        const value = req.body.value;
        
        let data = {};
        
        // 读取现有数据
        if (fs.existsSync(LOCALE_FILE)) {
            const content = fs.readFileSync(LOCALE_FILE, 'utf-8');
            data = JSON.parse(content);
        }
        
        // 确保语言对象存在
        if (!data[lang]) {
            data[lang] = {};
        }
        
        // 更新词条
        if (value === null || value === undefined) {
            delete data[lang][key];
            // 清理空语言对象
            if (Object.keys(data[lang]).length === 0) {
                delete data[lang];
            }
        } else {
            data[lang][key] = value;
        }
        
        // 写入文件
        fs.writeFileSync(LOCALE_FILE, JSON.stringify(data, null, 2), 'utf-8');
        
        res.json({ success: true, data: data[lang][key] });
    } catch (error) {
        console.error('更新词条失败:', error);
        res.status(500).json({ error: '更新词条失败', message: error.message });
    }
});

/**
 * 批量删除词条
 */
app.delete('/api/locale/:lang/batch', (req, res) => {
    try {
        const { lang } = req.params;
        const keys = req.body.keys; // ['KEY1', 'KEY2', ...]
        
        let data = {};
        
        // 读取现有数据
        if (fs.existsSync(LOCALE_FILE)) {
            const content = fs.readFileSync(LOCALE_FILE, 'utf-8');
            data = JSON.parse(content);
        }
        
        // 批量删除
        let count = 0;
        if (data[lang]) {
            keys.forEach(key => {
                if (data[lang][key]) {
                    delete data[lang][key];
                    count++;
                }
            });
            
            // 清理空语言对象
            if (Object.keys(data[lang]).length === 0) {
                delete data[lang];
            }
        }
        
        // 写入文件
        fs.writeFileSync(LOCALE_FILE, JSON.stringify(data, null, 2), 'utf-8');
        
        res.json({ success: true, count, message: `删除 ${count} 个词条` });
    } catch (error) {
        console.error('批量删除失败:', error);
        res.status(500).json({ error: '批量删除失败', message: error.message });
    }
});

// 启动服务
app.listen(PORT, () => {
    console.log(`\n🌍 国际化配置服务已启动`);
    console.log(`   监听端口：http://localhost:${PORT}`);
    console.log(`   语言包文件：${LOCALE_FILE}`);
    console.log(`\nAPI 端点:`);
    console.log(`   GET    /api/locale          - 读取语言包`);
    console.log(`   POST   /api/locale          - 保存语言包（全量）`);
    console.log(`   PATCH  /api/locale/:lang/:key - 更新单个词条`);
    console.log(`   PATCH  /api/locale/:lang/batch - 批量更新`);
    console.log(`   DELETE /api/locale/:lang/batch - 批量删除\n`);
});

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('../'));

// 使用内存数据库
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('SQLite 内存数据库连接失败:', err);
    } else {
        console.log('✅ 已连接到 SQLite 内存数据库');
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    const createTables = `
        CREATE TABLE IF NOT EXISTS website0721_users (
            id TEXT PRIMARY KEY,
            nickname TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS website0721_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            tool TEXT NOT NULL,
            assistant_material TEXT NOT NULL,
            amount REAL NOT NULL,
            activity_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS website0721_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            is_seed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS website0721_clipboards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            has_password BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    db.exec(createTables, (err) => {
        if (err) {
            console.error('创建表失败:', err);
        } else {
            console.log('✅ 内存数据库表初始化完成');
        }
    });
}

// 获取 UTC+8 时间
function getUTCP8Time() {
    const now = new Date();
    // UTC+8 = UTC + 8小时
    const utc8 = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return utc8.toISOString();
}

// 格式化时间为 UTC+8 的本地字符串
function formatUTCP8Time(dateString) {
    try {
        const date = new Date(dateString);
        const utc8 = new Date(date.getTime() + (8 * 60 * 60 * 1000));
        return utc8.toLocaleString('zh-CN');
    } catch (e) {
        return '时间未知';
    }
}

// API路由
app.post('/api/activity', (req, res) => {
    const { identity, tool, assistantMaterial, amount } = req.body;
    
    if (!identity || !tool || !assistantMaterial || !amount) {
        return res.json({ success: false, error: '缺少必要参数' });
    }

    const activityDate = getUTCP8Time().split('T')[0];
    
    // 确保用户存在
    const userQuery = 'INSERT OR IGNORE INTO website0721_users (id, nickname) VALUES (?, ?)';
    db.run(userQuery, [identity, identity], function(err) {
        if (err) {
            console.error('保存用户失败:', err);
            return res.json({ success: false, error: '保存失败' });
        }

        // 保存活动记录
        const activityQuery = 'INSERT INTO website0721_activities (user_id, tool, assistant_material, amount, activity_date) VALUES (?, ?, ?, ?, ?)';
        db.run(activityQuery, [identity, tool, assistantMaterial, amount, activityDate], function(err) {
            if (err) {
                console.error('保存活动记录失败:', err);
                return res.json({ success: false, error: '保存失败' });
            }
            
            res.json({ 
                success: true, 
                data: {
                    id: this.lastID,
                    identity,
                    tool,
                    assistantMaterial,
                    amount: parseFloat(amount),
                    date: getUTCP8Time(),
                    created_at: getUTCP8Time()
                }
            });
        });
    });
});

// 获取用户个人活动记录
app.get('/api/activities/:identity', (req, res) => {
    const { identity } = req.params;
    
    const query = `
        SELECT a.*, u.nickname 
        FROM website0721_activities a 
        LEFT JOIN website0721_users u ON a.user_id = u.id 
        WHERE a.user_id = ? 
        ORDER BY a.created_at DESC
    `;
    db.all(query, [identity], (err, results) => {
        if (err) {
            console.error('查询活动记录失败:', err);
            return res.json({ success: false, error: '查询失败' });
        }
        
        // 格式化时间为 UTC+8
        const formattedResults = results.map(activity => ({
            ...activity,
            display_time: formatUTCP8Time(activity.created_at)
        }));
        
        res.json({ success: true, data: formattedResults });
    });
});

// 获取所有用户的公开活动记录
app.get('/api/activities', (req, res) => {
    const query = `
        SELECT a.*, u.nickname 
        FROM website0721_activities a 
        LEFT JOIN website0721_users u ON a.user_id = u.id 
        ORDER BY a.created_at DESC 
        LIMIT 50
    `;
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('查询公开活动记录失败:', err);
            return res.json({ success: false, error: '查询失败' });
        }
        
        // 格式化时间为 UTC+8
        const formattedResults = results.map(activity => ({
            ...activity,
            display_time: formatUTCP8Time(activity.created_at)
        }));
        
        res.json({ success: true, data: formattedResults });
    });
});

app.post('/api/message', (req, res) => {
    const { identity, content } = req.body;
    
    if (!identity || !content) {
        return res.json({ success: false, error: '缺少必要参数' });
    }

    const isSeed = content.includes('种子') || content.includes('seed');
    
    // 确保用户存在
    const userQuery = 'INSERT OR IGNORE INTO website0721_users (id, nickname) VALUES (?, ?)';
    db.run(userQuery, [identity, identity], function(err) {
        if (err) {
            console.error('保存用户失败:', err);
            return res.json({ success: false, error: '保存失败' });
        }

        // 保存留言
        const messageQuery = 'INSERT INTO website0721_messages (user_id, content, is_seed) VALUES (?, ?, ?)';
        db.run(messageQuery, [identity, content, isSeed ? 1 : 0], function(err) {
            if (err) {
                console.error('保存留言失败:', err);
                return res.json({ success: false, error: '保存失败' });
            }
            
            res.json({ 
                success: true, 
                data: {
                    id: this.lastID,
                    identity: identity,
                    nickname: identity,
                    content,
                    isSeed,
                    created_at: getUTCP8Time(),
                    display_time: formatUTCP8Time(getUTCP8Time())
                }
            });
        });
    });
});

app.get('/api/messages', (req, res) => {
    const query = `
        SELECT m.*, u.nickname 
        FROM website0721_messages m 
        LEFT JOIN website0721_users u ON m.user_id = u.id 
        ORDER BY m.created_at DESC
    `;
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('查询留言失败:', err);
            return res.json({ success: false, error: '查询失败' });
        }
        
        // 格式化时间为 UTC+8
        const formattedResults = results.map(message => ({
            ...message,
            display_time: formatUTCP8Time(message.created_at)
        }));
        
        res.json({ success: true, data: formattedResults });
    });
});

app.post('/api/clipboard', (req, res) => {
    const { identity, content, password } = req.body;
    
    if (!identity || !content) {
        return res.json({ success: false, error: '缺少必要参数' });
    }

    // 确保用户存在
    const userQuery = 'INSERT OR IGNORE INTO website0721_users (id, nickname) VALUES (?, ?)';
    db.run(userQuery, [identity, identity], function(err) {
        if (err) {
            console.error('保存用户失败:', err);
            return res.json({ success: false, error: '保存失败' });
        }

        // 保存剪贴板内容
        const clipboardQuery = 'INSERT INTO website0721_clipboards (user_id, content, has_password) VALUES (?, ?, ?)';
        db.run(clipboardQuery, [identity, content, password ? 1 : 0], function(err) {
            if (err) {
                console.error('保存剪贴板失败:', err);
                return res.json({ success: false, error: '保存失败' });
            }
            
            res.json({ 
                success: true, 
                data: {
                    id: this.lastID,
                    identity: identity,
                    nickname: identity,
                    content,
                    hasPassword: !!password,
                    created_at: getUTCP8Time(),
                    display_time: formatUTCP8Time(getUTCP8Time())
                }
            });
        });
    });
});

app.get('/api/clipboards', (req, res) => {
    const query = `
        SELECT c.*, u.nickname 
        FROM website0721_clipboards c 
        LEFT JOIN website0721_users u ON c.user_id = u.id 
        ORDER BY c.created_at DESC
    `;
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('查询剪贴板失败:', err);
            return res.json({ success: false, error: '查询失败' });
        }
        
        // 格式化时间为 UTC+8
        const formattedResults = results.map(item => ({
            ...item,
            display_time: formatUTCP8Time(item.created_at)
        }));
        
        res.json({ success: true, data: formattedResults });
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 website0721 服务器运行在 http://localhost:${PORT}`);
    console.log('💾 使用 SQLite 内存数据库');
    console.log('⏰ 使用 UTC+8 时区');
});

process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
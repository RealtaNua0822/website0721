const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('../'));

/*SQLite 数据库连接
const dbPath = path.join(__dirname, 'website0721.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('SQLite 连接失败:', err);
    } else {
        console.log('✅ 已连接到 SQLite 数据库');
        initDatabase();
    }
});
*/

// 使用内存数据库（避免权限问题）
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
        -- 用户身份表
        CREATE TABLE IF NOT EXISTS website0721_users (
            id TEXT PRIMARY KEY,
            nickname TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 0721活动记录表
        CREATE TABLE IF NOT EXISTS website0721_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            tool TEXT NOT NULL,
            amount REAL NOT NULL,
            activity_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 留言表
        CREATE TABLE IF NOT EXISTS website0721_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            is_seed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 剪贴板表
        CREATE TABLE IF NOT EXISTS website0721_clipboards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            has_password BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_activities_user_date ON website0721_activities(user_id, activity_date);
        CREATE INDEX IF NOT EXISTS idx_messages_created ON website0721_messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_clipboards_created ON website0721_clipboards(created_at);
    `;

    db.exec(createTables, (err) => {
        if (err) {
            console.error('创建表失败:', err);
        } else {
            console.log('✅ 数据库表初始化完成');
        }
    });
}

// API路由 - 0721活动
app.post('/api/activity', (req, res) => {
    const { identity, tool, amount } = req.body;
    const activityDate = new Date().toISOString().split('T')[0];
    
    // 首先确保用户存在
    const userQuery = 'INSERT OR IGNORE INTO website0721_users (id, nickname) VALUES (?, ?)';
    db.run(userQuery, [identity, identity.split('#')[0]], function(err) {
        if (err) {
            console.error('保存用户失败:', err);
            return res.json({ success: false, error: '保存失败' });
        }

        // 保存活动记录
        const activityQuery = `
            INSERT INTO website0721_activities (user_id, tool, amount, activity_date) 
            VALUES (?, ?, ?, ?)
        `;
        db.run(activityQuery, [identity, tool, amount, activityDate], function(err) {
            if (err) {
                console.error('保存活动记录失败:', err);
                return res.json({ success: false, error: '保存失败' });
            }
            
            const activity = {
                id: this.lastID,
                identity,
                tool,
                amount: parseFloat(amount),
                date: new Date().toISOString(),
                activityDate: activityDate
            };
            
            res.json({ success: true, data: activity, storage: 'sqlite' });
        });
    });
});

app.get('/api/activities/:identity', (req, res) => {
    const { identity } = req.params;
    
    const query = `
        SELECT id, user_id as identity, tool, amount, activity_date as date, created_at 
        FROM website0721_activities 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    `;
    
    db.all(query, [identity], (err, results) => {
        if (err) {
            console.error('查询活动记录失败:', err);
            return res.json({ success: false, error: '查询失败' });
        }
        res.json({ success: true, data: results, storage: 'sqlite' });
    });
});

// 留言板API
app.post('/api/message', (req, res) => {
    const { identity, content } = req.body;
    const isSeed = content.includes('种子') || content.includes('seed');
    
    // 确保用户存在
    const userQuery = 'INSERT OR IGNORE INTO website0721_users (id, nickname) VALUES (?, ?)';
    db.run(userQuery, [identity, identity.split('#')[0]], function(err) {
        if (err) {
            console.error('保存用户失败:', err);
            return res.json({ success: false, error: '保存失败' });
        }

        // 保存留言
        const messageQuery = `
            INSERT INTO website0721_messages (user_id, content, is_seed) 
            VALUES (?, ?, ?)
        `;
        db.run(messageQuery, [identity, content, isSeed ? 1 : 0], function(err) {
            if (err) {
                console.error('保存留言失败:', err);
                return res.json({ success: false, error: '保存失败' });
            }
            
            const message = {
                id: this.lastID,
                identity: maskIdentity(identity),
                content,
                isSeed,
                date: new Date().toISOString()
            };
            
            res.json({ success: true, data: message, storage: 'sqlite' });
        });
    });
});

app.get('/api/messages', (req, res) => {
    const query = `
        SELECT m.id, m.user_id, u.nickname, m.content, m.is_seed, m.created_at as date
        FROM website0721_messages m
        LEFT JOIN website0721_users u ON m.user_id = u.id
        ORDER BY m.created_at DESC
    `;
    
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('查询留言失败:', err);
            return res.json({ success: false, error: '查询失败' });
        }
        
        const maskedResults = results.map(msg => ({
            ...msg,
            identity: maskIdentity(msg.user_id)
        }));
        
        res.json({ success: true, data: maskedResults, storage: 'sqlite' });
    });
});

// 剪贴板API
app.post('/api/clipboard', (req, res) => {
    const { identity, content, password } = req.body;
    
    // 确保用户存在
    const userQuery = 'INSERT OR IGNORE INTO website0721_users (id, nickname) VALUES (?, ?)';
    db.run(userQuery, [identity, identity.split('#')[0]], function(err) {
        if (err) {
            console.error('保存用户失败:', err);
            return res.json({ success: false, error: '保存失败' });
        }

        // 保存剪贴板内容
        const clipboardQuery = `
            INSERT INTO website0721_clipboards (user_id, content, has_password) 
            VALUES (?, ?, ?)
        `;
        db.run(clipboardQuery, [identity, content, password ? 1 : 0], function(err) {
            if (err) {
                console.error('保存剪贴板失败:', err);
                return res.json({ success: false, error: '保存失败' });
            }
            
            const clipboard = {
                id: this.lastID,
                identity: maskIdentity(identity),
                content,
                hasPassword: !!password,
                date: new Date().toISOString()
            };
            
            res.json({ success: true, data: clipboard, storage: 'sqlite' });
        });
    });
});

app.get('/api/clipboards', (req, res) => {
    const query = `
        SELECT c.id, c.user_id, u.nickname, c.content, c.has_password, c.created_at as date
        FROM website0721_clipboards c
        LEFT JOIN website0721_users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
    `;
    
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('查询剪贴板失败:', err);
            return res.json({ success: false, error: '查询失败' });
        }
        
        const maskedResults = results.map(item => ({
            ...item,
            identity: maskIdentity(item.user_id)
        }));
        
        res.json({ success: true, data: maskedResults, storage: 'sqlite' });
    });
});

// 身份打码函数
function maskIdentity(identity) {
    const parts = identity.split('#');
    if (parts.length === 2) {
        const name = parts[0];
        const maskedName = name.length > 2 ? 
            name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1) : 
            name.charAt(0) + '*';
        return `${maskedName}#${parts[1]}`;
    }
    return identity;
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 website0721 服务器运行在 http://localhost:${PORT}`);
    console.log(`💾 使用 SQLite 数据库: ${dbPath}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('关闭数据库失败:', err);
        } else {
            console.log('✅ 数据库连接已关闭');
        }
        process.exit(0);
    });
});
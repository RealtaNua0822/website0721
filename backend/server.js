const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('../')); // 服务前端文件

// 数据库连接
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    database: '0721_platform'
});

// 简单内存数据库（开发用）
let activities = [];
let messages = [];
let clipboards = [];

// API路由 - 0721活动
app.post('/api/activity', (req, res) => {
    const { identity, tool, amount } = req.body;
    const activity = {
        id: Date.now(),
        identity,
        tool,
        amount: parseFloat(amount),
        date: new Date().toISOString()
    };
    activities.push(activity);
    res.json({ success: true, data: activity });
});

app.get('/api/activities/:identity', (req, res) => {
    const { identity } = req.params;
    const userActivities = activities.filter(a => a.identity === identity);
    res.json({ success: true, data: userActivities });
});

// API路由 - 留言板
app.post('/api/message', (req, res) => {
    const { identity, content } = req.body;
    const isSeed = content.includes('种子') || content.includes('seed'); // 简单种子检测
    
    const message = {
        id: Date.now(),
        identity: maskIdentity(identity),
        content,
        isSeed,
        date: new Date().toISOString()
    };
    
    messages.push(message);
    res.json({ success: true, data: message });
});

app.get('/api/messages', (req, res) => {
    res.json({ success: true, data: messages });
});

// API路由 - 剪贴板
app.post('/api/clipboard', (req, res) => {
    const { identity, content, password } = req.body;
    const clipboard = {
        id: Date.now(),
        identity: maskIdentity(identity),
        content,
        hasPassword: !!password,
        date: new Date().toISOString()
    };
    
    clipboards.push(clipboard);
    res.json({ success: true, data: clipboard });
});

app.get('/api/clipboards', (req, res) => {
    res.json({ success: true, data: clipboards });
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
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
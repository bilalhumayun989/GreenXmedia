const User = require('../models/User');

/**
 * Helper — extract the real client IP from a request.
 *
 * Priority order:
 * 1. X-Client-IP header — set by the frontend after fetching from ipify (handles localhost dev)
 * 2. x-forwarded-for — set by Vercel / Nginx / proxies in production
 * 3. x-real-ip — set by some reverse proxies
 * 4. socket remoteAddress — raw TCP connection IP (will be ::1 on localhost)
 *
 * We normalise IPv6-mapped IPv4 addresses like ::ffff:192.168.1.1 → 192.168.1.1
 */
const getClientIp = (req) => {
    // Frontend can send the browser-detected public IP in this header
    const clientIpHeader = req.headers['x-client-ip'];
    if (clientIpHeader && isValidIp(clientIpHeader)) {
        return clientIpHeader.trim();
    }

    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ip = forwarded.split(',')[0].trim();
        return normaliseIp(ip);
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) return normaliseIp(realIp.trim());

    const socketIp =
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        'unknown';

    return normaliseIp(socketIp);
};

/** Strip IPv6-mapped IPv4 prefix: ::ffff:1.2.3.4 → 1.2.3.4 */
const normaliseIp = (ip) => {
    if (!ip) return 'unknown';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
};

/** Basic sanity check — must look like an IPv4 or IPv6 address */
const isValidIp = (ip) => {
    if (!ip || typeof ip !== 'string') return false;
    const trimmed = ip.trim();
    // IPv4
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) return true;
    // IPv6 (loose check)
    if (trimmed.includes(':') && trimmed.length >= 2) return true;
    return false;
};

/**
 * Returns true if the IP is a loopback or private/reserved address.
 * We don't want to store ::1 or 127.0.0.1 as the "office IP".
 */
const isPrivateIp = (ip) => {
    if (!ip) return true;
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('10.')) return true;
    if (ip.match(/^172\.(1[6-9]|2\d|3[01])\./)) return true;
    if (ip === 'unknown') return true;
    return false;
};

// @desc    Get manager home dashboard data
// @route   GET /api/manager/home
// @access  Private — Manager or Admin
const getManagerHome = async (req, res) => {
    try {
        const isManager = req.user.role === 'Manager';
        const isAdmin   = req.user.role === 'Admin';

        if (!isManager && !isAdmin) {
            return res.status(403).json({ message: 'Access denied. Manager or Admin only.' });
        }

        const adminId = req.user.role === 'Admin' ? req.user._id : req.user.adminId;
        const admin   = await User.findById(adminId).select('officeIp officeIpUpdatedAt ipRestrictionEnabled name');
        if (!admin) return res.status(404).json({ message: 'Admin record not found' });

        // Prefer the browser-detected IP sent in the header; fall back to server-side
        const detectedIp = getClientIp(req);

        return res.json({
            detectedIp,
            storedIp:             admin.officeIp,
            officeIpUpdatedAt:    admin.officeIpUpdatedAt,
            ipRestrictionEnabled: admin.ipRestrictionEnabled,
            adminName:            admin.name,
            isSynced:             !!admin.officeIp && admin.officeIp === detectedIp,
            isPrivate:            isPrivateIp(detectedIp),
        });
    } catch (error) {
        console.error('Error in getManagerHome:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Manager/Admin pushes current public IP as the office IP
// @route   POST /api/manager/update-ip
// @access  Private — Manager or Admin
const updateOfficeIp = async (req, res) => {
    try {
        const isManager = req.user.role === 'Manager';
        const isAdmin   = req.user.role === 'Admin';

        if (!isManager && !isAdmin) {
            return res.status(403).json({ message: 'Access denied. Manager or Admin only.' });
        }

        // Accept client-reported IP (from browser ipify call) for accuracy
        // Server-side IP detection fails on localhost / behind certain proxies
        const detectedIp = getClientIp(req);

        if (!detectedIp || detectedIp === 'unknown') {
            return res.status(400).json({ message: 'Could not detect IP address. Make sure you are connected to the internet.' });
        }

        if (isPrivateIp(detectedIp)) {
            return res.status(400).json({
                message: `Detected IP "${detectedIp}" is a private/loopback address. The browser must send your public IP via X-Client-IP header. Please try refreshing the page.`,
            });
        }

        const adminId = req.user.role === 'Admin' ? req.user._id : req.user.adminId;
        const admin   = await User.findById(adminId);
        if (!admin) return res.status(404).json({ message: 'Admin record not found' });

        admin.officeIp          = detectedIp;
        admin.officeIpUpdatedAt = new Date();
        await admin.save();

        return res.json({
            message:          `Office IP updated to ${detectedIp}`,
            detectedIp,
            officeIpUpdatedAt: admin.officeIpUpdatedAt,
        });
    } catch (error) {
        console.error('Error in updateOfficeIp:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Admin: get current office IP status
// @route   GET /api/manager/ip-status
// @access  Private — Admin only
const getOfficeIpStatus = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Admin access only.' });
        }

        const admin = await User.findById(req.user._id).select('officeIp officeIpUpdatedAt ipRestrictionEnabled');
        if (!admin) return res.status(404).json({ message: 'Admin record not found' });

        const requestIp = getClientIp(req);

        return res.json({
            storedIp:             admin.officeIp,
            officeIpUpdatedAt:    admin.officeIpUpdatedAt,
            ipRestrictionEnabled: admin.ipRestrictionEnabled,
            yourCurrentIp:        requestIp,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Admin: toggle IP restriction on/off
// @route   PUT /api/manager/ip-restriction
// @access  Private — Admin only
const toggleIpRestriction = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Admin access only.' });
        }

        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ message: 'enabled field must be a boolean' });
        }

        const admin = await User.findById(req.user._id);
        if (!admin) return res.status(404).json({ message: 'Admin record not found' });

        admin.ipRestrictionEnabled = enabled;
        await admin.save();

        return res.json({
            message:              `IP restriction ${enabled ? 'enabled' : 'disabled'}`,
            ipRestrictionEnabled: admin.ipRestrictionEnabled,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getManagerHome,
    updateOfficeIp,
    getOfficeIpStatus,
    toggleIpRestriction,
    getClientIp,
    isPrivateIp,
};

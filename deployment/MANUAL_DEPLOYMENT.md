# Manual Deployment Guide for Digital Ocean Droplet

This guide provides step-by-step instructions for manually deploying the coding platform to a Digital Ocean droplet.

## Prerequisites

- Digital Ocean droplet with Ubuntu 22.04 or later
- Root or sudo access
- Judge0 already installed and running on port 2358
- Your droplet's IP address

## Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

## Step 2: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE coding_platform;
CREATE USER coding_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE coding_platform TO coding_user;
\c coding_platform
GRANT ALL ON SCHEMA public TO coding_user;
\q
EOF
```

## Step 3: Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 4: Install Go

```bash
# Download Go
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz

# Extract and install
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz

# Add to PATH
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Verify installation
go version

# Clean up
rm go1.21.6.linux-amd64.tar.gz
```

## Step 5: Create Project Directory

```bash
sudo mkdir -p /opt/coding-platform
sudo chown -R $USER:$USER /opt/coding-platform
```

## Step 6: Upload Project Files

From your local machine:

```bash
# Option 1: Using SCP
scp -r coding-platform root@YOUR_DROPLET_IP:/opt/

# Option 2: Using Git
ssh root@YOUR_DROPLET_IP
cd /opt
git clone YOUR_REPOSITORY_URL coding-platform
```

## Step 7: Configure Backend

```bash
cd /opt/coding-platform/backend

# Create .env file
cat > .env << 'EOF'
PORT=8080
GIN_MODE=release

DB_HOST=localhost
DB_PORT=5432
DB_USER=coding_user
DB_PASSWORD=your_secure_password
DB_NAME=coding_platform

JWT_SECRET=your_jwt_secret_key_change_this_to_something_very_secure

JUDGE0_URL=http://localhost:2358
EOF

# Install Go dependencies
go mod download
go mod tidy
```

## Step 8: Configure Frontend

```bash
cd /opt/coding-platform/frontend

# Update API URL
nano js/api.js
# Change: const API_BASE_URL = 'http://YOUR_DROPLET_IP/api';
```

## Step 9: Configure Nginx

```bash
# Copy nginx configuration
sudo cp /opt/coding-platform/deployment/nginx.conf /etc/nginx/sites-available/coding-platform

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/coding-platform /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 10: Setup Systemd Service

```bash
# Copy service file
sudo cp /opt/coding-platform/deployment/coding-platform.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable coding-platform

# Start service
sudo systemctl start coding-platform

# Check status
sudo systemctl status coding-platform
```

## Step 11: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Step 12: Verify Installation

```bash
# Check backend service
sudo systemctl status coding-platform

# Check backend logs
sudo journalctl -u coding-platform -n 50

# Check Nginx
sudo systemctl status nginx

# Test backend health
curl http://localhost:8080/health

# Test from browser
# Open: http://YOUR_DROPLET_IP
```

## Step 13: Create Admin User

```bash
# Access the web interface
# Register a new user
# Then update their role in database:

sudo -u postgres psql -d coding_platform << EOF
UPDATE users SET role = 'admin' WHERE username = 'your_username';
EOF
```

## Step 14: Add Sample Problem (Optional)

```bash
# First, login and get JWT token from the web interface
# Then use curl to create a problem:

curl -X POST http://YOUR_DROPLET_IP/api/problems \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Two Sum",
    "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    "difficulty": "easy",
    "time_limit": 2000,
    "memory_limit": 256000
  }'

# Add test case
curl -X POST http://YOUR_DROPLET_IP/api/problems/1/testcases \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "2 7 11 15\n9",
    "expected_output": "0 1",
    "is_sample": true,
    "points": 10
  }'
```

## Optional: Setup HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

## Maintenance Commands

### View Logs
```bash
# Backend logs
sudo journalctl -u coding-platform -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Restart Services
```bash
# Restart backend
sudo systemctl restart coding-platform

# Reload Nginx
sudo systemctl reload nginx

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Update Application
```bash
# Pull latest changes
cd /opt/coding-platform
git pull

# Update backend
cd backend
go mod tidy
sudo systemctl restart coding-platform

# Update frontend (no action needed, static files)
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
sudo journalctl -u coding-platform -n 100 --no-pager

# Check if port is in use
sudo lsof -i :8080

# Test database connection
sudo -u postgres psql -d coding_platform -c "SELECT 1;"
```

### Can't connect to Judge0
```bash
# Check if Judge0 is running
curl http://localhost:2358/about

# Check Judge0 containers
docker ps | grep judge0

# Restart Judge0
cd /path/to/judge0
docker-compose restart
```

### Permission issues
```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/coding-platform

# Fix service permissions
sudo chmod 644 /etc/systemd/system/coding-platform.service
```

## Security Checklist

- [ ] Changed default database password
- [ ] Set strong JWT secret
- [ ] Configured firewall (UFW)
- [ ] Enabled HTTPS with SSL certificate
- [ ] Regular system updates scheduled
- [ ] Database backups configured
- [ ] Limited SSH access (key-based only)
- [ ] Disabled root login via SSH

## Next Steps

1. Create admin account
2. Add coding problems
3. Add test cases for each problem
4. Test code submission flow
5. Monitor logs for errors
6. Set up automated backups
7. Configure monitoring (optional)

## Support

For issues, check:
- Backend logs: `sudo journalctl -u coding-platform -f`
- Nginx logs: `/var/log/nginx/error.log`
- Judge0 status: `curl http://localhost:2358/about`

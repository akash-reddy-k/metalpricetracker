#!/bin/bash
# Run this once after SSH-ing into a fresh Ubuntu 24.04 EC2 instance.
# Usage: bash setup-ec2.sh

set -e

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

echo "==> Installing PM2 (process manager)..."
sudo npm install -g pm2

echo "==> Cloning repo..."
# Replace with your actual GitHub repo URL
git clone https://github.com/YOUR_USERNAME/metalpricetracker.git
cd metalpricetracker

echo "==> Installing dependencies..."
npm ci --omit=dev

echo "==> Starting server with PM2..."
pm2 start --name metals-api npx -- tsx entry.node.ts

echo "==> Saving PM2 process list (survives reboots)..."
pm2 save
pm2 startup | tail -1 | sudo bash   # registers PM2 as a systemd service

echo ""
echo "Done! Server running on port 3000."
echo "Test it: curl http://localhost:3000/health"

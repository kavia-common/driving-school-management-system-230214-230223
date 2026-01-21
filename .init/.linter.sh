#!/bin/bash
cd /home/kavia/workspace/code-generation/driving-school-management-system-230214-230223/admin_web_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi


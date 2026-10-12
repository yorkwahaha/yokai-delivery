// This project uses Pillow for image generation; no local sharp installation is required.
const cp=require('node:child_process');
const result=cp.spawnSync(process.env.PYTHON||'python',['tools/optimize-vfx-webp.py'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;

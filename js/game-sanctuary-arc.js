// Lv5-only visual halo above the approved raster sanctuary painting.
// The semi-transparent shell intentionally overlays the courier so the
// character visually stands INSIDE the dome; never affects collisions.
(() => {
  const root=typeof window!=="undefined"?window:globalThis;
  const draw=(ctx,field,elapsed=0,tilt=0.6)=>{
    if(!field||field.life<=0||!field.maxLife||field.level!==5)return false;
    const fraction=Math.max(0,Math.min(1,field.life/field.maxLife));
    const fade=Math.min(1,(1-fraction)*7, fraction*3);
    if(fade<=0)return false;
    const {x,y}=field;
    // The caller counteracts the floor tilt with VIEWPORT.upright(), so this
    // shell actually rises above the seal instead of flattening into a ring.
    const radius=field.r*.92;
    const groundY=radius*.25;
    const archHeight=radius*.97;
    const pulse=1+Math.sin(elapsed*2.5)*.025;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(pulse,pulse);
    ctx.globalAlpha*=fade;
    const shell=ctx.createLinearGradient(0,-archHeight,0,groundY);
    shell.addColorStop(0,"rgba(218,251,251,.30)");
    shell.addColorStop(.48,"rgba(88,213,225,.17)");
    shell.addColorStop(.80,"rgba(101,211,217,.12)");
    shell.addColorStop(1,"rgba(244,211,139,.22)");
    // Back-facing arch with a very faint glass-like filling. Keep the
    // lower center largely transparent so player/monsters remain readable.
    ctx.beginPath();
    ctx.moveTo(-radius,0);
    ctx.bezierCurveTo(-radius*.82,-archHeight*1.30,radius*.82,-archHeight*1.30,radius,0);
    ctx.ellipse(0,0,radius,groundY,0,0,Math.PI,false);
    ctx.closePath();
    ctx.fillStyle=shell;
    ctx.fill();
    // A single hand-painted-feeling arc with a soft rim. Avoid extra rings
    // or grid lines: those already exist in the underlying approved PNG.
    ctx.beginPath();
    ctx.moveTo(-radius,0);
    ctx.bezierCurveTo(-radius*.82,-archHeight*1.30,radius*.82,-archHeight*1.30,radius,0);
    // A tapering pigment rim: the rim fades away seamlessly at both
    // endpoints rather than terminating as a hard outlined circle.
    const rim=ctx.createLinearGradient(-radius,0,radius,0);
    rim.addColorStop(0,"rgba(169,255,245,0)");
    rim.addColorStop(.12,"rgba(169,255,245,.33)");
    rim.addColorStop(.35,"rgba(181,255,247,.68)");
    rim.addColorStop(.50,"rgba(222,255,251,.78)");
    rim.addColorStop(.65,"rgba(181,255,247,.68)");
    rim.addColorStop(.88,"rgba(169,255,245,.33)");
    rim.addColorStop(1,"rgba(169,255,245,0)");
    ctx.strokeStyle=rim;
    ctx.lineWidth=4.2;
    ctx.shadowColor="rgba(129,254,241,.68)";
    ctx.shadowBlur=17;
    ctx.stroke();
    ctx.shadowBlur=0;
    // Faint rim connects the vertical arc to the existing floor seal.
    ctx.beginPath();
    ctx.ellipse(0,0,radius,groundY,0,0,Math.PI,false);
    ctx.lineWidth=2.2;
    const groundRim=ctx.createLinearGradient(-radius,0,radius,0);
    groundRim.addColorStop(0,"rgba(248,216,133,0)");
    groundRim.addColorStop(.3,"rgba(248,216,133,.28)");
    groundRim.addColorStop(.7,"rgba(248,216,133,.28)");
    groundRim.addColorStop(1,"rgba(248,216,133,0)");
    ctx.strokeStyle=groundRim;
    ctx.stroke();
    ctx.restore();
    return true;
  };
  root.YOKAI_SANCTUARY_ARC={draw};
  if(typeof module!=="undefined"&&module.exports)module.exports={draw};
})();

"""Local independent S1-S4 boss BGM candidates; existing authored files are never overwritten."""
import importlib.util, json, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("stage58_producer",ROOT/"tools/produce-stage58-audio.py")
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
p.WORK=ROOT/"art/audio/early-boss-candidates"
p.WORK.mkdir(parents=True,exist_ok=True)
rows=[
("night-town",26112781,132,"D minor","tense night patrol escalating into supernatural duel, driving odaiko, tight shamisen ostinato, low shakuhachi, dark plucked koto, rhythmic urgency, minor mode, never cheerful"),
("rain-port",26112782,126,"E minor","stormy midnight harbor boss confrontation, rolling deep taiko, restrained shamisen, irregular waterlike percussion, powerful dark strings, storm pressure, urgent but clear pulse"),
("sakura-pass",26112783,140,"A minor","haunted mountain cherry blossom duel, fierce shamisen phrases, rapid taiko, plaintive shakuhachi, windlike strings, elegant ominous Japanese action score"),
("bamboo-maze",26112784,146,"G minor","bamboo labyrinth climactic guardian duel, sharp wooden percussion, rapid shamisen, heavy syncopated taiko, tense breathy bamboo flute, energetic dangerous rhythmic drive")]
q=p.request("/queue")
if q["queue_running"] or q["queue_pending"]: raise RuntimeError("Existing ComfyUI jobs; no interference")
report={}
for stage,seed,bpm,key,brief in rows:
    target=ROOT/f"assets/audio/bgm/stages/{stage}/{stage}__boss.mp3"
    if target.exists():
        print("preserve authored existing",target,flush=True)
        continue
    row={"id":stage+"-f9-boss","kind":"music","seconds":72,"seed":seed,"bpm":bpm,"key":key,"loop":True,"priority":"P0","path":f"art/audio/early-boss-candidates/{stage}__boss.mp3","prompt":"instrumental soundtrack, Japanese supernatural action RPG, "+brief+", coherent looping combat music, no voices, no lyrics, no speech, no pop chorus, no silence, steady rhythm"}
    try:
        p.render(row,seed)
        result=p.master(row,[0]) or {}
        qa=p.verify(row)
        source=ROOT/row["path"]
        with target.open("xb") as f: f.write(source.read_bytes())
        report[stage]={"status":"DEV_CANDIDATE_PENDING_LISTEN","runtime":str(target.relative_to(ROOT)),"candidate":row["path"],"prompt":row["prompt"],**result,**qa}
        print(stage,qa,flush=True)
    except Exception as e:
        report[stage]={"status":"FAILED","error":str(e)}
        print(stage,"FAILED",str(e),flush=True)
    (p.WORK/"f9-production.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
if any(r["status"]=="FAILED" for r in report.values()): raise SystemExit(1)

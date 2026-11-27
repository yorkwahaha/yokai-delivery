#!/usr/bin/env python3
"""Idempotently apply user-approved 20-word Stage3 revision, leaving 6 other stages intact."""
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
FILE=ROOT/'js/delivery-lexicon.js'
ORDER=[
 "さくら","はな","は","えだ","くさ","たね","き","いし","かえる","すず",
 "おまもり","くつ","かさ","だんご","おちゃ","うちわ","あり","ほうき","ふえ","くすり"
]
REPLACEMENTS={
 "き": {"jp":"き","zh":"樹／木","kanji":"木","emoji":"🌳"},
 "かえる": {"jp":"かえる","zh":"青蛙","kanji":"蛙","emoji":"🐸"},
 "あり": {"jp":"あり","zh":"螞蟻","kanji":"","emoji":"🐜"},
 "ほうき": {"jp":"ほうき","zh":"掃帚","kanji":"","emoji":"🧹"},
 "ふえ": {"jp":"ふえ","zh":"笛子","kanji":"笛","emoji":"🎶"},
 "くすり": {"jp":"くすり","zh":"藥","kanji":"薬","emoji":"💊"}
}
OLD=[
 "さくら","はな","はなたば","は","えだ","くさ","たね","うえきばち",
 "はちうえ","いし","すず","おまもり","くつ","かさ","だんご","おちゃ",
 "ちゃば","ゆのみ","せんす","うちわ"
]
def main():
    raw=FILE.read_text(encoding='utf-8')
    start=raw.index('{"id":"sakura-pass"')
    end=raw.index('{"id":"bamboo-maze"',start)
    segment=raw[start:end].rstrip(',')
    stage=json.loads(segment)
    previous=[w["jp"] for w in stage["words"]]
    if previous==ORDER:
        print('ALREADY_FINAL',len(previous))
        return
    if previous!=OLD:
        raise SystemExit('Stage3 word list differs from expected baseline; refuse overwrite: '+str(previous))
    original={w['jp']:w for w in stage["words"]}
    assert len(original)==20 and len(set(ORDER))==20
    for jp in ORDER:
        assert jp in original or jp in REPLACEMENTS,jp
    stage['words']=[original.get(jp,REPLACEMENTS.get(jp)) for jp in ORDER]
    assert len(stage['words'])==20
    replacement=json.dumps(stage,ensure_ascii=False,separators=(',',':'))+','
    FILE.write_text(raw[:start]+replacement+raw[end:],encoding='utf-8')
    print('STAGE3_FINALIZED',len(ORDER),'kept',sum(x in original for x in ORDER),
          'added',list(REPLACEMENTS),'other stages bytes unchanged',flush=True)
if __name__=="__main__":main()

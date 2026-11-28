(() => {
  "use strict";
  const titles = {cards:"秘術卡片", words:"單字圖鑑", build:"本局構築"};
  const categories = ["主動", "被動", "變異", "御守", "合武"];
  const typeOf = entry => entry.type.split("・")[0];
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const artURL = source => window.ASSET_PATHS?.resolve(source) || source;

  function focusControl(node) {
    if (!node) return;
    node.focus({preventScroll:true});
    node.scrollIntoView({block:"nearest", inline:"nearest"});
  }

  function moveFocus(region, direction) {
    const active = document.activeElement;
    const choices = Array.from(region.querySelectorAll("button:not(:disabled), input:not(:disabled)"))
      .filter(button => button.getClientRects().length > 0 &&
        (button === active || button.getAttribute("role") !== "tab" || button.tabIndex === 0));
    if (!choices.includes(active)) { focusControl(choices[0]); return !!choices.length; }
    const rectangles = choices.map(button => button.getBoundingClientRect());
    const target = window.COMPENDIUM_MODEL.spatialTarget(rectangles[choices.indexOf(active)], rectangles, direction);
    if (target < 0) return false;
    focusControl(choices[target]);
    return true;
  }

  function image(source, fallback, defer) {
    const img = el("img");
    img.alt = "";
    img.decoding = "async";
    if (source) {
      img.addEventListener("error", () => {
        if (fallback) { img.src = artURL(fallback); fallback = null; }
        else { img.hidden = true; img.parentElement?.classList.add("art-missing"); }
      });
      const load = () => { img.src = artURL(source); };
      if (defer) defer(img, load);
      else load();
    } else img.hidden = true;
    return img;
  }

  function create() {
    const root = el("dialog", "yc-book");
    root.setAttribute("aria-labelledby", "yc-book-title");
    root.classList.toggle("local-font",
      new URLSearchParams(location.search).get("uiFont") === "hanwang" &&
      (window.DEV_MODE?.isLoopback?.(location) || window.DEV_MODE?.isDevMode?.(location)));
    const shell = el("div", "yc-shell");
    const header = el("header", "yc-head");
    const title = el("h1", "", "夜行典籍");
    title.id = "yc-book-title";
    const tabs = el("nav", "yc-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "夜行典籍");
    const review = el("div", "yc-review");
    const panel = el("main", "yc-panel");
    panel.id = "yc-panel";
    panel.setAttribute("role", "tabpanel");
    const foot = el("footer", "yc-foot");
    const popup = el("dialog", "yc-detail");
    popup.setAttribute("aria-labelledby", "yc-detail-title");
    const feedback = el("span", "yc-visually-hidden");
    feedback.setAttribute("role", "status");
    header.append(title, tabs);
    shell.append(header, review, panel, foot, feedback);
    root.append(shell, popup);
    document.body.append(root);

    let context, tab, group, selection, filter, page, opener;
    let detailFrom = null;
    const model = window.COMPENDIUM_MODEL;
    const query = matchMedia("(max-height: 565px), (max-width: 740px)");
    const pendingThumbnails = new WeakMap();
    const thumbnails = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        pendingThumbnails.get(entry.target)?.();
        pendingThumbnails.delete(entry.target);
        thumbnails.unobserve(entry.target);
      }
    }) : null;
    const deferThumbnail = thumbnails && ((img, load) => {
      pendingThumbnails.set(img, load);
      thumbnails.observe(img);
    });
    let lastWordSize;
    const wordSize = () => query.matches ? 4 : 8;
    const tabIds = () => Object.keys(titles);
    const panelButton = key => Array.from(root.querySelectorAll("button[data-key]"))
      .find(button => button.dataset.key === key && !button.disabled);
    const focus = focusControl;
    const control = (key, label, action, className = "yc-control") => {
      const button = el("button", className, label);
      button.type = "button";
      button.dataset.key = key;
      button.addEventListener("click", action);
      return button;
    };
    const rowOf = id => context.secrets.find(entry => entry.emblem === id);
    const sealed = card => context.locked(card.emblem);
    const label = node => node.setAttribute("aria-live", "polite");
    const mutationNames = id => window.GAME_CATALOG.mutationCardNames(id);

    function portrait(id, size = "", locked = false, item = false, thumbnail = false) {
      const box = el("span", "yc-portrait " + size);
      const src = id && !locked ? context.art(id, item) : null;
      if (locked) box.classList.add("sealed");
      if (locked && id) {
        box.classList.add("sealed-skill");
        box.append(image(context.art("charm_guard", true)?.path));
        return box;
      }
      if (src?.path && !locked) {
        const img = image(src.path, src.fallback, thumbnail && deferThumbnail);
        const view = el("span", src.card ? "yc-illustration framed" : "yc-illustration");
        view.append(img);
        box.append(view);
        if (src.card) {
          box.classList.add("framed");
          const names = mutationNames(id);
          const phase42 = window.__YOKAI_UPGRADE_PHASE42;
          if (names && phase42?.titlePoint && phase42?.classPoint) {
            const {titlePoint, classPoint} = phase42;
            box.classList.add("mutation-portrait");
            for (const [name, point, role] of [[names.title, titlePoint, "title"], [names.subtitle, classPoint, "subtitle"]]) {
              const plaque = el("span", "yc-mutation-plaque " + role);
              plaque.setAttribute("aria-hidden", "true");
              plaque.style.setProperty("--plaque-offset", point.y / 1536 - .5);
              plaque.style.setProperty("--plaque-width", point.w / 1024);
              plaque.style.setProperty("--plaque-height", point.h / 1536);
              plaque.style.setProperty("--glyphs", Array.from(name).length);
              plaque.append(el("span", "", name));
              box.append(plaque);
            }
          }
        }
      } else box.classList.add("art-missing");
      return box;
    }

    function selectTab(id) {
      if (!tabIds().includes(id)) return;
      tab = id;
      render("tab:" + id);
    }

    function buttonWithArt(key, id, name, action, style, locked = false, item = false) {
      const button = control(key, undefined, action, style);
      button.append(portrait(id, "", locked, item, style === "yc-entry"), el("span", "", name));
      return button;
    }

    function cardDetail(card, from, status = "") {
      const locked = sealed(card);
      openDetail(locked ? "？？？" : card.name, from, box => {
        const layout = el("div", "yc-detail-body");
        const text = el("div");
        layout.append(portrait(card.emblem, "", locked), text);
        if (card.jp && !locked) {
          const japanese = el("p", "yc-reading", card.jp);
          japanese.lang = "ja"; text.append(japanese);
        }
        if (locked || status) text.append(el("b", "yc-detail-status", locked ? "尚未解鎖" : status));
        text.append(el("p", "", context.describe(card)));
        box.append(layout);
      });
    }

    function openDetail(title, from, populate) {
      detailFrom = from;
      const heading = el("h2", "", title);
      heading.id = "yc-detail-title";
      const content = el("section", "yc-detail-scroll");
      populate(content);
      const back = control("detail-back", "關閉", closeDetail);
      popup.replaceChildren(heading, content, back);
      popup.showModal();
      focus(content.querySelector("button:not(:disabled)") || back);
    }

    function closeDetail() {
      popup.close();
      popup.replaceChildren();
      if (tab === "words" && lastWordSize !== wordSize()) render(detailFrom);
      else focus(panelButton(detailFrom));
      detailFrom = null;
    }

    function renderCards() {
      const catalog = context.secrets.filter(card => typeOf(card) === group && (group !== "變異" || !sealed(card)));
      if (!catalog.some(card => card.emblem === selection)) selection = catalog[0]?.emblem;
      const selected = rowOf(selection);
      const aside = el("aside", "yc-index");
      const groups = el("div", "yc-groups");
      for (const category of categories) {
        const button = control("group:" + category, category, () => {
          group = category;
          render("group:" + category);
        });
        button.setAttribute("aria-pressed", String(category === group));
        groups.append(button);
      }
      const entries = el("div", "yc-entries");
      for (const card of catalog) {
        const locked = sealed(card);
        const key = "secret:" + card.emblem;
        const button = buttonWithArt(key, card.emblem, locked ? "？？？" : card.name, () => {
          selection = card.emblem;
          render(key);
        }, "yc-entry", locked);
        button.lastChild.append(el("small", "", context.status(card) || "已解鎖"));
        button.setAttribute("aria-pressed", String(card === selected));
        entries.append(button);
      }
      aside.append(groups, entries);
      const hero = el("section", "yc-hero");
      const right = el("section", "yc-paper yc-secret");
      if (selected) {
        const copy = el("div", "yc-secret-copy");
        right.append(copy);
        const locked = sealed(selected);
        const illustration = portrait(selected.emblem, "hero", locked);
        const heading = el("h2", "", locked ? "？？？" : selected.name);
        if (illustration.classList.contains("framed")) {
          if (illustration.classList.contains("mutation-portrait")) heading.classList.add("yc-visually-hidden");
          else {
            heading.classList.add("yc-card-name");
            heading.style.setProperty("--glyphs", Math.max(5, Array.from(selected.name).length));
            // Reuse the authoritative card class on the existing blue plaque.
            const category = !locked && window.GAME_SKILL_EXPANSION?.cards[selected.emblem]?.category;
            const point=window.__YOKAI_UPGRADE_PHASE42?.classPoint;
            if (category && point) {
              const plaque=el("span","yc-mutation-plaque subtitle");
              plaque.style.setProperty("--plaque-offset",point.y/1536-.5);
              plaque.style.setProperty("--plaque-width",point.w/1024);
              plaque.style.setProperty("--plaque-height",point.h/1536);
              plaque.style.setProperty("--glyphs",Array.from(category).length);
              plaque.append(el("span","",category));
              illustration.append(plaque);
            }
          }
          illustration.append(heading);
          hero.classList.add("inscribed");
        }
        hero.append(illustration);
        if (!hero.classList.contains("inscribed")) hero.append(heading);
        const signature = el("p", "", locked ? "尚未解鎖" : context.kind(selected));
        if (selected.jp && !locked) {
          const japanese = el("span", "yc-reading", selected.jp);
          japanese.lang = "ja";
          signature.append(" · ", japanese);
        }
        hero.append(signature);
        const title = el("div", "yc-secret-head");
        title.append(el("h3", "", locked ? "解鎖條件" : "秘術效果"),
          el("span", "yc-state", context.status(selected) || "已解鎖"));
        copy.append(title, el("p", "yc-overview", context.describe(selected)));
        if (!locked && typeOf(selected) === "主動") {
          copy.append(el("h3", "", "修行階段"));
          const levels = el("ol", "yc-levels");
          context.levels(selected.emblem).forEach((text, i, all) => {
            const row = el("li", i === all.length - 1 ? "awakening" : "");
            row.append(el("b", "", "Lv" + (i + 1)), el("span", "", text));
            levels.append(row);
          });
          copy.append(levels);
          const related = context.related(selected.emblem);
          if (related.length) {
            const variants = el("div", "yc-secret-variants");
            variants.append(el("h3", "", "對應變異"));
            const strip = el("div", "yc-related");
            for (const id of related) {
              const card = rowOf(id);
              if (!card) continue;
              const key = "related:" + id;
              const button = control(key, undefined, () => cardDetail(card, key), "yc-related-card");
              button.setAttribute("aria-label", card.name);
              button.append(portrait(id));
              button.title = context.describe(card);
              strip.append(button);
            }
            variants.append(strip);
            right.append(variants);
          }
        }
      }
      const spread = el("div", "yc-spread");
      spread.append(aside, hero, right);
      panel.append(spread);
      return null;
    }

    function filterButton(kind, name, catalog) {
      const selected = catalog.find(option => option.id === filter[kind]);
      const key = "filter:" + kind;
      return control(key, name + " · " + (selected?.name || "全部") + " ▾", () => {
        openDetail(name, key, box => {
          if (kind === "pack" && context.words.packLine) box.append(el("p", "yc-pack-status", context.words.packLine));
          const list = el("div", "yc-filter-list");
          for (const option of [{id:null, name:"全部"}, ...catalog]) {
            const choice = control("option:" + option.id, option.name, () => {
              filter[kind] = option.id;
              page = 0;
              closeDetail();
              render(key);
            });
            choice.setAttribute("aria-pressed", String(option.id === filter[kind]));
            list.append(choice);
          }
          box.append(list);
        });
      }, "yc-control yc-filter");
    }

    function wordCard(card) {
      const open = card.reveal === "open";
      const face = open
        ? control("listen:" + card.wordId, undefined, () => {
          context.speak(card.jp);
          feedback.textContent = "播放 " + card.jp;
        }, "yc-word")
        : el("article", "yc-word sealed");
      const field = el("span", "yc-word-art");
      const note = el("span", "yc-word-note");
      if (open) {
        const src = context.wordArt(card.jp);
        field.append(image(src));
        if (!src) field.classList.add("art-missing");
        const base = card.kanji || card.jp;
        const word = el("strong", "", base);
        word.lang = "ja";
        note.append(word);
        if (card.kana && card.kana !== base) {
          const reading = el("span", "yc-reading", card.kana);
          reading.lang = "ja";
          note.append(reading);
        }
        note.append(el("span", "yc-zh", card.zh));
        face.setAttribute("aria-label", "再聽 " + base + "，" + card.zh);
        field.append(el("span", "yc-listen", "再聽"));
      } else {
        field.append(el("span", "yc-seal", "封"));
        note.append(el("strong", "", "尚未收藏"));
      }
      note.append(el("span", "yc-mark", card.progress));
      face.append(field, note);
      return face;
    }

    function renderWords() {
      const gallery = context.words;
      lastWordSize = wordSize();
      const result = model.wordPage(gallery.cards, filter, page, lastWordSize);
      page = result.page;
      const layout = el("section", "yc-words");
      const ribbon = el("div", "yc-word-tools");
      const completion = el("div", "yc-completion");
      const completeText = el("span", "", "收藏 " + result.opened + " / " + result.count);
      label(completeText);
      const progress = el("progress");
      progress.max = result.count || 1;
      progress.value = result.opened;
      progress.setAttribute("aria-label", "篩選後收藏完成度");
      completion.append(completeText, progress);
      if (gallery.packLine) completion.title = gallery.packLine;
      ribbon.append(filterButton("stage", "關卡", gallery.catalogs.stages),
        filterButton("pack", "詞包", gallery.catalogs.packs), completion);
      const grid = el("div", "yc-word-grid");
      if (result.cards.length) grid.append(...result.cards.map(wordCard));
      else grid.append(el("p", "yc-empty-filter", "此關卡與詞包沒有共同單字"));
      layout.append(ribbon, grid);
      panel.append(layout);
      return result;
    }

    function mutationButton(id, key, status, showEffect) {
      const card = rowOf(id);
      if (!card) return null;
      const title = mutationNames(id)?.title || card.name || id;
      const button = buttonWithArt(key, id, title, () => cardDetail(card, key, status), "yc-mutation");
      if (showEffect) button.lastChild.append(el("small", "", context.shortEffect(card)));
      return button;
    }

    function buildSlot(slot, index, maxRank) {
      const box = el("article", "yc-build-slot");
      if (!slot) {
        box.classList.add("empty");
        box.append(portrait(null, "empty-card", true), el("h3", "", "空技能欄位"));
        return box;
      }
      const card = rowOf(slot.id);
      if (!card) {
        box.classList.add("empty");
        box.append(portrait(slot.id, "empty-card", true), el("h3", "", slot.id || "未知技能"));
        return box;
      }
      const main = el("div", "yc-build-skill");
      const artKey = "build-skill:" + slot.id;
      const view = control(artKey, undefined, () => cardDetail(card, artKey, "Lv" + slot.rank), "yc-build-art");
      view.setAttribute("aria-label", card.name + "效果");
      view.append(portrait(slot.id));
      main.append(view);
      const skillText = el("div", "yc-build-name");
      skillText.append(el("h3", "", card.name), el("b", "", "Lv" + slot.rank));
      const ranks = el("span", "yc-ranks");
      ranks.setAttribute("aria-hidden", "true");
      for (let i = 0; i < maxRank; i++) ranks.append(el("i", i < slot.rank ? "filled" : ""));
      skillText.append(ranks);
      main.append(skillText);
      const variants = el("div", "yc-variants");
      const head = el("div", "yc-variant-head");
      head.append(el("span", "", "變異"),
        el("span", slot.capacity && slot.owned.length === slot.capacity ? "complete" : "",
          slot.capacity ? slot.owned.length + " / " + slot.capacity : "無變異槽"));
      const key = "candidates:" + slot.id;
      if (slot.candidates.length) head.append(control(key, "候選", () => {
        openDetail(card.name + " · 可取得變異", key, body => {
          const list = el("div", "yc-candidate-list");
          for (const id of slot.candidates) {
            const row = rowOf(id);
            if (!row) continue;
            const item = el("div", "yc-mutation");
            item.append(portrait(id), el("span", "", mutationNames(id)?.title || row.name || id));
            item.lastChild.append(el("small", "", context.describe(row)));
            list.append(item);
          }
          body.append(list);
        });
      }, "yc-control yc-candidates"));
      variants.append(head);
      for (let i = 0; i < slot.capacity; i++) {
        const id = slot.owned[i];
        const row = id
          ? mutationButton(id, "owned:" + index + ":" + id, "本局已取得", true)
          : el("div", "yc-mutation missing");
        if (!id) row.append(portrait(null, "", true), el("span", "", "未取得"));
        if (row) variants.append(row);
      }
      box.append(main, variants);
      return box;
    }

    function possessions(title, items, unit) {
      const row = el("section", "yc-possession");
      row.append(el("h3", "", title));
      const entries = el("div", "yc-possession-list");
      for (const {id, count} of items) {
        const card = rowOf(id);
        if (!card) continue;
        const tier = unit === "層" ? count + " 層" : "Lv" + count;
        const key = "item:" + id;
        const button = buttonWithArt(key, id, card.name,
          () => cardDetail(card, key, tier), "yc-control yc-item", false, true);
        button.lastChild.append(el("small", "", tier));
        entries.append(button);
      }
      if (!items.length) entries.append(el("span", "yc-quiet", "尚未取得"));
      row.append(entries);
      return row;
    }

    function renderBuild() {
      const data = context.build;
      if (!data) {
        const note = el("section", "yc-no-run");
        note.append(portrait(null, "empty-card", true), el("h2", "", "尚未開始夜行"),
          el("p", "", "進入關卡後，可在暫停選單查看本局構築。"));
        panel.append(note);
        return null;
      }
      const summary = el("div", "yc-summary");
      for (const [name, count, total] of [
        ["主動技能", data.summary.active, data.summary.activeMax],
        ["滿級技能", data.summary.full, data.summary.activeMax],
        ["已取得變異", data.summary.mutations, data.summary.mutationMax]
      ]) {
        const stat = el("div");
        stat.append(el("span", "", name), el("strong", "", count + " / " + total));
        summary.append(stat);
      }
      const slots = el("div", "yc-build-grid");
      data.slots.forEach((slot, i) => slots.append(buildSlot(slot, i, data.maxRank)));
      const accessories = el("div", "yc-accessories");
      accessories.append(possessions("被動修行", data.passives, "層"), possessions("裝備御守", data.charms, "Lv"));
      const content = el("section", "yc-build");
      content.append(summary, slots, accessories);
      panel.append(content);
      return null;
    }

    function render(key) {
      const entries = panel.querySelector(".yc-entries");
      const indexScroll = entries?.scrollTop || 0;
      tabs.replaceChildren();
      for (const id of tabIds()) {
        const button = control("tab:" + id, titles[id], () => selectTab(id), "yc-bookmark");
        button.id = "yc-tab-" + id;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(id === tab));
        button.setAttribute("aria-controls", panel.id);
        button.tabIndex = id === tab ? 0 : -1;
        tabs.append(button);
      }
      panel.setAttribute("aria-labelledby", "yc-tab-" + tab);
      thumbnails?.disconnect();
      panel.replaceChildren();
      const paging = tab === "cards" ? renderCards() : tab === "words" ? renderWords() : renderBuild();
      if (key?.startsWith("secret:")) {
        const entries = panel.querySelector(".yc-entries");
        if (entries) entries.scrollTop = indexScroll;
      }
      const back = control("back", "‹　返回", context.close, "yc-control yc-back");
      const pager = el("div", "yc-pager");
      if (paging) {
        const turn = (delta, direction) => { page += delta; render(direction); };
        const prev = control("prev", "‹ 上一頁", () => turn(-1, "prev"));
        const next = control("next", "下一頁 ›", () => turn(1, "next"));
        prev.disabled = paging.page === 0;
        next.disabled = paging.page >= paging.pageCount - 1;
        const indicator = el("span", "", (paging.page + 1) + " / " + paging.pageCount);
        label(indicator);
        pager.append(prev, indicator, next);
      }
      const hint = el("div");
      hint.append(el("p", "yc-keys", "方向鍵 選擇　Tab／LB・RB 切頁"));
      if (tab === "build" && context.build) hint.append(el("p", "yc-short-hint", "下捲查看被動與御守"));
      foot.replaceChildren(back, pager, hint);
      focus(panelButton(key) || (key === "next" && panelButton("prev")) ||
        (key === "prev" && panelButton("next")) || panelButton("tab:" + tab));
    }

    function stepTab(direction) {
      const ids = tabIds();
      selectTab(ids[(ids.indexOf(tab) + direction + ids.length) % ids.length]);
    }

    function move(direction) {
      const active = document.activeElement;
      if (active?.getAttribute("role") === "tab" && (direction === "left" || direction === "right")) {
        stepTab(direction === "left" ? -1 : 1);
        return true;
      }
      return moveFocus(popup.open ? popup : shell, direction);
    }

    function back() {
      if (popup.open) closeDetail();
      else context.close();
    }

    root.addEventListener("cancel", event => { event.preventDefault(); back(); });
    popup.addEventListener("cancel", event => { event.preventDefault(); closeDetail(); });
    root.addEventListener("pointerdown", () => root.removeAttribute("data-pad"));
    root.addEventListener("keydown", event => {
      if (handleKey(event, context.keyAction(event.code))) event.preventDefault();
      event.stopPropagation();
    });
    query.addEventListener("change", () => {
      if (root.open && tab === "words" && !popup.open) render(document.activeElement?.dataset.key);
    });

    function handleKey(event, action) {
      root.removeAttribute("data-pad");
      if (event.code === "Escape" || action === "pause" || action === "codex") {
        if (!event.repeat) back();
        return true;
      }
      if (event.code === "Tab" && !popup.open) { stepTab(event.shiftKey ? -1 : 1); return true; }
      if (action === "mute") { if (!event.repeat) context.mute?.(); return true; }
      const direction = {ArrowLeft:"left", ArrowRight:"right", ArrowUp:"up", ArrowDown:"down",
        l:"left", r:"right", u:"up", d:"down"}[event.code] ||
        {l:"left", r:"right", u:"up", d:"down"}[action];
      if (direction) return move(direction);
      if (tab === "words" && !popup.open && (event.code === "PageUp" || event.code === "PageDown")) {
        panelButton(event.code === "PageUp" ? "prev" : "next")?.click();
        return true;
      }
      if (tab === "cards" && !popup.open && (event.code === "PageUp" || event.code === "PageDown")) {
        const paper = panel.querySelector(".yc-secret");
        const copy = paper?.querySelector(".yc-secret-copy");
        const scroller = copy?.scrollHeight > copy.clientHeight ? copy : paper;
        scroller?.scrollBy(0, scroller.clientHeight * (event.code === "PageUp" ? -.75 : .75));
        return true;
      }
      if (action === "interact" && event.code !== "Enter") {
        if (!event.repeat) document.activeElement?.click();
        return true;
      }
      return false;
    }

    return {
      open(tabId, data, keep = false) {
        if (!root.open) opener = document.activeElement;
        context = data;
        if (!keep) { group = "主動"; selection = null; filter = {stage:null, pack:null}; page = 0; }
        if (context.review) {
          const heading = el("span", "", "DEV 驗收");
          review.replaceChildren(heading, ...Object.entries(context.review.labels).map(([id, name]) => {
            const button = control("fixture:" + id, name, () => context.review.select(id), "yc-control yc-fixture");
            button.setAttribute("aria-pressed", String(id === context.review.id));
            return button;
          }));
          root.classList.add("review");
        } else root.classList.remove("review");
        tab = tabIds().includes(tabId) ? tabId : "cards";
        if (!root.open) root.showModal();
        render(keep ? "fixture:" + context.review?.id : "tab:" + tab);
      },
      tab: () => tab,
      refreshArt() {
        if (root.open && !popup.open) render(document.activeElement?.dataset.key);
      },
      close(returnTo) {
        if (popup.open) closeDetail();
        root.close();
        focus(opener?.matches?.("body") ? returnTo : opener || returnTo);
        thumbnails?.disconnect();
        panel.replaceChildren();
        review.replaceChildren();
        context = null;
      },
      key: handleKey,
      gamepad(pressed, direction) {
        if (!direction && ![0,1,4,5,8,9].some(pressed)) return;
        root.setAttribute("data-pad", "");
        if (pressed(1) || pressed(8) || pressed(9)) back();
        else if (!popup.open && (pressed(4) || pressed(5))) stepTab(pressed(4) ? -1 : 1);
        else if (direction) move(direction);
        else if (pressed(0)) document.activeElement?.click();
      }
    };
  }

  window.UI_COMPENDIUM = Object.freeze({create, focusControl, moveFocus});
})();

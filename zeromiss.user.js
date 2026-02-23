// ==UserScript==
// @name         ZeroMiss
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  View highlighted keywords in a stylish draggable dialog, grouped by color
// @author       You
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    GM_registerMenuCommand("Show Highlighted Keywords", runHighlighter);

    function runHighlighter() {

        function isFromCurrentPage(el) {
            try {
                if (el.ownerDocument !== document) return false;
                if (el.closest && el.closest("iframe")) return false;
                return true;
            } catch (e) {
                return false;
            }
        }

        function isVisible(el) {
            if (!el) return false;
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            return true;
        }

        const old = document.getElementById("hk-stylish-dialog");
        if (old) old.remove();

        const highlights = [];

        function categorizeColor(bg) {
            const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (!m) return null;
            const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);

            if (r > 200 && g < 120 && b < 120) return { key: "Restricted", color: bg };
            if (r > 200 && g > 200 && b < 120) return { key: "Generic", color: bg };
            if (g > 200 && r < 120 && b < 120) return { key: "NLR Keywords", color: bg };
            return null;
        }

        document.querySelectorAll("*").forEach(el => {
            const style = getComputedStyle(el);
            const bg = style.backgroundColor;
            if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
                const text = el.innerText && el.innerText.trim();
                if (text && text.length < 120 && isVisible(el) && isFromCurrentPage(el)) {
                    const cat = categorizeColor(bg);
                    if (cat) highlights.push({ text, category: cat.key, color: cat.color, el });
                }
            }
        });

        if (!highlights.length) {
            alert("No highlighted keywords found.");
            return;
        }

        const dialog = document.createElement("div");
        dialog.id = "hk-stylish-dialog";
        dialog.innerHTML = `
            <div class="hk-header">
                <span>Highlighted Keywords</span>
                <button id="hk-close">✕</button>
            </div>
            <div class="hk-content"></div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            #hk-stylish-dialog {
                resize: both;
                overflow: auto;
                position: fixed;
                top: 8%;
                right: 5%;
                width: 360px;
                max-height: 75%;
                background: #ffffff;
                border-radius: 14px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.25);
                z-index: 999999;
                font-family: "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: slideIn 0.25s ease-out;
            }

            @keyframes slideIn {
                from { transform: translateX(20px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            .hk-header {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: #fff;
                padding: 12px 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 15px;
                font-weight: 600;
                cursor: move;
            }

            #hk-close {
                background: rgba(255,255,255,0.2);
                border: none;
                color: #fff;
                border-radius: 50%;
                width: 26px;
                height: 26px;
                cursor: pointer;
                font-size: 14px;
            }

            .hk-content {
                padding: 12px;
                overflow-y: auto;
            }

            .hk-group { margin-bottom: 14px; }

            .hk-group-title {
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .hk-color-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                display: inline-block;
            }

            .hk-item {
                background: #f5f6fa;
                border-radius: 8px;
                padding: 6px 8px;
                font-size: 13px;
                margin-bottom: 6px;
                border-left: 4px solid;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);

        const grouped = {};
        highlights.forEach(h => {
            grouped[h.category] = grouped[h.category] || [];
            grouped[h.category].push({ text: h.text, color: h.color, el: h.el });
        });

        Object.keys(grouped).forEach(category => {
            const map = new Map();
            grouped[category].forEach(item => {
                const key = item.text.toLowerCase();
                if (!map.has(key)) {
                    map.set(key, { text: item.text, color: item.color, els: [], index: 0, clicks: 0 });
                }
                map.get(key).els.push(item.el);
            });
            grouped[category] = Array.from(map.values()).sort((a, b) => a.text.localeCompare(b.text));
        });

        const content = dialog.querySelector(".hk-content");

        Object.keys(grouped).forEach(category => {
            const group = document.createElement("div");
            group.className = "hk-group";

            const title = document.createElement("div");
            title.className = "hk-group-title";
            title.innerHTML = `<span class="hk-color-dot" style="background:${grouped[category][0].color}"></span>${category}`;
            group.appendChild(title);

            grouped[category].forEach(obj => {
                const item = document.createElement("div");
                item.className = "hk-item";
                item.style.borderLeftColor = obj.color;
                item.innerHTML = `<span>${obj.text} (${obj.els.length})</span><span style="float:right;font-weight:600;">0</span>`;

                item.onclick = () => {
                    obj.clicks++;
                    if (obj.clicks > obj.els.length) obj.clicks = 1;
                    item.lastChild.textContent = obj.clicks;

                    const el = obj.els[obj.index];
                    obj.index = (obj.index + 1) % obj.els.length;

                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.style.outline = "3px solid black";
                    setTimeout(() => el.style.outline = "", 1500);
                };

                group.appendChild(item);
            });

            content.appendChild(group);
        });

        dialog.querySelector("#hk-close").onclick = () => dialog.remove();

        makeDraggable(dialog);
        document.body.appendChild(dialog);
    }

    function makeDraggable(dialog) {
        let isDown = false, offsetX = 0, offsetY = 0;
        const header = dialog.querySelector(".hk-header");

        header.addEventListener("mousedown", e => {
            isDown = true;
            offsetX = dialog.offsetLeft - e.clientX;
            offsetY = dialog.offsetTop - e.clientY;
            e.preventDefault();
        });

        document.addEventListener("mouseup", () => isDown = false);
        document.addEventListener("mousemove", e => {
            if (!isDown) return;
            dialog.style.left = (e.clientX + offsetX) + "px";
            dialog.style.top = (e.clientY + offsetY) + "px";
            dialog.style.right = "auto";
        });
    }

})();

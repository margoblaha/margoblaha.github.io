---
title: "Topics"
permalink: /topics/
layout: single
excerpt: "Everything on Epistemic Margins, gathered by theme."
---
{%- assign hidden = site.topics_hide | join: "|" | downcase | split: "|" -%}
{%- capture counted -%}{%- for tag in site.tags -%}{%- assign key = tag[0] | downcase -%}{%- unless hidden contains key -%}{{ 9999 | minus: tag[1].size }}#{{ tag[0] }}|{%- endunless -%}{%- endfor -%}{%- endcapture -%}
{%- assign ranked = counted | split: "|" | sort -%}
{%- for entry in ranked -%}
{%- assign name = entry | split: "#" | last -%}
<h2 id="{{ name | slugify }}">{{ name }}</h2>
{% assign tagged = site.tags[name] %}{% include post-index.html posts=tagged %}
{%- endfor -%}

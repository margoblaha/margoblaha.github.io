---
title: "Essays"
permalink: /essays/
layout: single
---
Longer pieces on ideas I can't stop thinking about.

{% for post in site.categories.essays %}
- [{{ post.title }}]({{ post.url | relative_url }}) · {{ post.date | date: "%-d %B %Y" }}
{% endfor %}

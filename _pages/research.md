---
title: "Research"
permalink: /research/
layout: single
---
## Publications
- Author, A. (Year). Title. *Journal*. https://doi.org/…

## Research notes
{% for post in site.categories.notes %}
- [{{ post.title }}]({{ post.url | relative_url }}) · {{ post.date | date: "%-d %B %Y" }}
{% endfor %}

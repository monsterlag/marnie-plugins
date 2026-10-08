![Preview image](./git-assets/preview.gif)

# pixel-buddy
Simple Claude Code plugin that shows usage meters, and a cache timer. That's really about it.

This is a fork of [hamymarnie/marnie-plugins](https://github.com/hamymarnie/marnie-plugins) that adds a third ring: how close the session is to its next compaction, and the tokens compaction has saved.
The ring is fed by the [monster-compact](https://github.com/monsterlag/monster-compact) plugin (0.7.0 or later); without it the band is drawn as upstream draws it.

```
/plugin marketplace add monsterlag/marnie-plugins
/plugin install pixel-buddy@monsterlag-plugins
```
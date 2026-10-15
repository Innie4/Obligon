# Local application fonts

The root layout loads normal variable Inter and Plus Jakarta Sans locally through `next/font/local`, with weights 400–800, `display: swap`, and the existing `--font-inter` and `--font-plus-jakarta` variables. No font download is required during a build.

Inter comes from the [official Google Fonts repository](https://github.com/google/fonts/blob/67bc647ce1910e92f461bcc82aae30f21d21a9cc/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf). Its original TTF SHA256 is `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`. It was compressed with fontTools 4.67.0 using `woff2.compress(source, output, transform_tables=[])`. No glyphs or axes were removed. The output SHA256 is `351f50d53207a6a7d8643edfa2520468627b141466d572493c0ef1b3075d0311`. All tables match after decoding except the required head checksum and WOFF2 compression flag; every glyph advance also matches at weights 400–800 and optical sizes 14 and 32.

Plus Jakarta Sans is the [original vendor WOFF2](https://github.com/tokotype/PlusJakartaSans/blob/18d1cd2f7ea10481919d2f05c1f7064b7307fc26/fonts/webfonts/PlusJakartaSans%5Bwght%5D.woff2), at the upstream revision documented by Google Fonts. Its SHA256 is `49c62cf1fb70f225ea113361f0134a48858c3a7d0175173aa3e38a0c6c8539d2`.

The two files total **425,360 bytes**. Both include Latin text and the naira glyph. The complete original SIL Open Font License 1.1 and copyright notices are served at `/fonts/Inter-OFL.txt` and `/fonts/PlusJakartaSans-OFL.txt`; font metadata also retains attribution. Font conversion tools were installed only in a disposable `/tmp` directory and are not project or runtime dependencies.

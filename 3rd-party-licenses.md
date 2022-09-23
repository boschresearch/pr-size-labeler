For a list of other open source components included in PR Size Labeler, see the
subfolders in the `node_modules` folder.
The licenses of those components can be found in the `LICENSE` file of their respective
subdirectory.
Unfortunately, the dependency `tr46` does not contain a license file in the version that we depend
on, but it names the license "MIT" in its `package.json`.
We thus include a [license file from a later version][license-url] of the library as
`tr-46-license.md`.

[license-url]: https://github.com/jsdom/tr46/blob/e937be8d9c04b7938707fc3701e50118b7c023a5/LICENSE.md

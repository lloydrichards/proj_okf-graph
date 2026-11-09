{
  description = "proj_okf-graph development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: import nixpkgs { inherit system; };
      # Pin the same Bun release as packageManager on every supported platform.
      bunSources = {
        aarch64-darwin = {
          platform = "darwin-aarch64";
          hash = "sha256-wkDX8My5DCY6hJ/NsJt+5iYw2SE0jtaq/ahrnVd7xRA=";
        };
        x86_64-darwin = {
          platform = "darwin-x64";
          hash = "sha256-UKNJH3Orwv6BZzFxqFdi07wswWgMzsrdmD3pmt93l34=";
        };
        aarch64-linux = {
          platform = "linux-aarch64";
          hash = "sha256-uqa7NvUdblhWHgK76oJQOKnfRU9nPW13bou/hvjHhQ4=";
        };
        x86_64-linux = {
          platform = "linux-x64";
          hash = "sha256-v4zL+ysLgBWeD5ptFcVTF63YB3U028YTCj7bUvzLOVw=";
        };
      };
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = pkgsFor system;
          bunSource = bunSources.${system};
          bun = pkgs.stdenvNoCC.mkDerivation {
            pname = "bun";
            version = "1.4.4";
            src = pkgs.fetchurl {
              url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-${bunSource.platform}.zip";
              inherit (bunSource) hash;
            };
            nativeBuildInputs = [ pkgs.unzip ];
            unpackPhase = "unzip $src";
            installPhase = "install -Dm755 bun-${bunSource.platform}/bun $out/bin/bun";
          };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              nodejs_24
              git
            ];

            shellHook = ''
              echo "Bun $(bun --version)"
              echo "Node $(node --version)"
            '';
          };
        }
      );
    };
}

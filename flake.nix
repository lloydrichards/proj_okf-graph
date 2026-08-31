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
      # Temporary until nixpkgs includes Bun 1.4.0: https://github.com/NixOS/nixpkgs/pull/556047
      bunSources = {
        aarch64-darwin = {
          platform = "darwin-aarch64";
          hash = "sha256-xmnpf2Fk4cluBwF0jbmN+ndJKQjL2DlMdVcTSnNd44E=";
        };
        x86_64-darwin = {
          platform = "darwin-x64";
          hash = "sha256-HQIRuPHcmRGCNEaHrRXnLuhvFUhFpff6R3mUzTQd2bA=";
        };
        aarch64-linux = {
          platform = "linux-aarch64";
          hash = "sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=";
        };
        x86_64-linux = {
          platform = "linux-x64";
          hash = "sha256-LQP7X7g6yLVnrKCigbLOGhoZ1Ij1bClo2Iw/Jekv5FI=";
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
            version = "1.4.0";
            src = pkgs.fetchurl {
              url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-${bunSource.platform}.zip";
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

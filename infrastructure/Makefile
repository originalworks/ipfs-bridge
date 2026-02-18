CAPABILITIES=CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM
REGION=us-east-1
PREFIX=storacha-bridge
ARTIFACT_NAME=storacha-bridge.zip
ARTIFACTS_BUCKET=artifacts-ow
TEMPLATE_FILE=template.yml

.deploy:
	sam deploy --template-file $(TEMPLATE_FILE) --stack-name $(STACK_NAME) --capabilities $(CAPABILITIES) --region $(REGION) --s3-bucket $(ARTIFACTS_BUCKET) --s3-prefix $(ENVIRONMENT) --parameter-overrides $(PARAMETERS) --no-fail-on-empty-changeset

deploy-dev: ENVIRONMENT=dev
deploy-dev: STACK_NAME=dev-storacha-bridge
deploy-dev: PARAMETERS_FILE=template-config.stage.json
deploy-dev: PARAMETERS=$(shell jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")' $(PARAMETERS_FILE))
deploy-dev: .deploy

deploy-prod: ENVIRONMENT=prod
deploy-prod: STACK_NAME=prod-storacha-bridge
deploy-prod: PARAMETERS_FILE=template-config.prod.json
deploy-prod: PARAMETERS=$(shell jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")' $(PARAMETERS_FILE))
deploy-prod: .deploy

cleanup:
	rm -rf out && \
	rm -rf ../dist && \
	rm -rf $(ARTIFACT_NAME)

storacha-bridge.zip: cleanup
	npm run build && \
	npm run esbuild && \
	mkdir -p out/node_modules && cp -r ../node_modules/app-root-path out/node_modules &&  \
	mkdir -p out/dist && cp -r ../dist/migrations out/dist && \
	zip -r storacha-bridge.zip out

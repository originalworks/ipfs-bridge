TEMPLATE_FILE=template.yml
CAPABILITIES=CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM
REGION=us-east-1
ARTIFACTS_BUCKET=artifacts-protocol
STACK_NAME=ipfs-bridge
ARTIFACT_NAME=ipfs-bridge.zip
PARAMETERS_FILE=template-config.$(ENVIRONMENT).json
PARAMETERS=$(shell jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")' $(PARAMETERS_FILE))

deploy-stage: ENVIRONMENT=stage
deploy-stage: .deploy

deploy-prod: ENVIRONMENT=prod
deploy-prod: .deploy

show-changeset-stage: ENVIRONMENT=stage
show-changeset-stage: .show-changeset

show-changeset-prod: ENVIRONMENT=prod
show-changeset-prod: .show-changeset

.deploy:
	sam deploy --template-file $(TEMPLATE_FILE) --stack-name $(ENVIRONMENT)-$(STACK_NAME) --capabilities $(CAPABILITIES) --region $(REGION) --s3-bucket $(ARTIFACTS_BUCKET) --s3-prefix $(ENVIRONMENT) --parameter-overrides $(PARAMETERS) --no-fail-on-empty-changeset

.show-changeset:
	sam deploy --template-file $(TEMPLATE_FILE) --stack-name $(ENVIRONMENT)-$(STACK_NAME) --capabilities $(CAPABILITIES) --region $(REGION) --s3-bucket $(ARTIFACTS_BUCKET) --s3-prefix $(ENVIRONMENT) --parameter-overrides $(PARAMETERS) --no-execute-changeset

cleanup:
	rm -rf out && \
	rm -rf ../dist && \
	rm -rf $(ARTIFACT_NAME)

ipfs-bridge.zip: cleanup
	npm run build && \
	npm run esbuild && \
	mkdir -p out/node_modules && cp -r ../node_modules/app-root-path out/node_modules &&  \
	mkdir -p out/dist && cp -r ../dist/migrations out/dist && \
	zip -r ipfs-bridge.zip out

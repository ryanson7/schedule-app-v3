// src/utils/googleDrive.js
export const uploadToGoogleDrive = async (imageBlob, fileName, folderName) => {
  // Google Drive API 초기화
  await gapi.load('client:auth2', async () => {
    await gapi.client.init({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: 'https://www.googleapis.com/auth/drive.file'
    });
  });

  // 인증 확인
  const authInstance = gapi.auth2.getAuthInstance();
  if (!authInstance.isSignedIn.get()) {
    await authInstance.signIn();
  }

  // 폴더 생성 또는 찾기
  const folderId = await createOrFindFolder(folderName);
  
  // 파일 업로드
  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
  form.append('file', imageBlob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${gapi.auth.getToken().access_token}`
    },
    body: form
  });

  return response.json();
};

const createOrFindFolder = async (folderName) => {
  // 기존 폴더 검색
  const response = await gapi.client.drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'`
  });

  if (response.result.files.length > 0) {
    return response.result.files[0].id;
  }

  // 새 폴더 생성
  const folderResponse = await gapi.client.drive.files.create({
    resource: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    }
  });

  return folderResponse.result.id;
};
